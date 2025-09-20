// blockchain/supplyChainContract.js
const Web3 = require('web3');
const HDWalletProvider = require('@truffle/hdwallet-provider');

class SupplyChainBlockchain {
  constructor() {
    this.provider = new HDWalletProvider({
      mnemonic: process.env.BLOCKCHAIN_MNEMONIC,
      providerOrUrl: process.env.BLOCKCHAIN_RPC_URL
    });
    
    this.web3 = new Web3(this.provider);
    this.initializeContract();
  }

  initializeContract() {
    const contractABI = require('./contracts/AgriSupplyChain.json').abi;
    const contractAddress = process.env.SUPPLY_CHAIN_CONTRACT_ADDRESS;
    
    this.contract = new this.web3.eth.Contract(contractABI, contractAddress);
    this.account = this.web3.eth.accounts.privateKeyToAccount(process.env.BLOCKCHAIN_PRIVATE_KEY);
  }

  async registerProduct(productData) {
    const {
      farmerId,
      cropType,
      quantity,
      harvestDate,
      location,
      certifications,
      qualityMetrics
    } = productData;
    
    // Generate unique product ID
    const productId = this.generateProductId(farmerId, harvestDate);
    
    // Create blockchain transaction
    const tx = this.contract.methods.registerProduct(
      productId,
      farmerId,
      cropType,
      quantity,
      harvestDate.getTime(),
      JSON.stringify({ location, certifications, qualityMetrics })
    );
    
    const gas = await tx.estimateGas({ from: this.account.address });
    const gasPrice = await this.web3.eth.getGasPrice();
    
    const signedTx = await this.account.signTransaction({
      to: this.contract.options.address,
      data: tx.encodeABI(),
      gas,
      gasPrice
    });
    
    const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    
    // Store in database with blockchain reference
    await Product.create({
      productId,
      farmerId,
      cropType,
      quantity,
      harvestDate,
      location,
      certifications,
      qualityMetrics,
      blockchain: {
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        timestamp: new Date()
      }
    });
    
    // Generate QR code
    const qrCode = await this.generateQRCode(productId);
    
    return {
      productId,
      transactionHash: receipt.transactionHash,
      qrCode
    };
  }

  async trackProduct(productId, eventType, eventData) {
    const events = {
      STORAGE: 'productStored',
      TRANSPORT: 'productTransported',
      PROCESSING: 'productProcessed',
      QUALITY_CHECK: 'qualityChecked',
      SALE: 'productSold'
    };
    
    const tx = this.contract.methods[events[eventType]](
      productId,
      eventData.location || '',
      eventData.handler || '',
      JSON.stringify(eventData.details || {}),
      Date.now()
    );
    
    const receipt = await this.sendTransaction(tx);
    
    // Update database
    await ProductEvent.create({
      productId,
      eventType,
      eventData,
      blockchain: {
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber
      }
    });
    
    return receipt;
  }

  async verifyProduct(productId) {
    // Get blockchain data
    const blockchainData = await this.contract.methods.getProduct(productId).call();
    
    // Get all events
    const events = await this.contract.getPastEvents('allEvents', {
      filter: { productId },
      fromBlock: 0,
      toBlock: 'latest'
    });
    
    // Build supply chain history
    const history = events.map(event => ({
      event: event.event,
      timestamp: new Date(parseInt(event.returnValues.timestamp) * 1000),
      location: event.returnValues.location,
      handler: event.returnValues.handler,
      details: JSON.parse(event.returnValues.details || '{}'),
      transactionHash: event.transactionHash
    }));
    
    // Verify authenticity
    const dbProduct = await Product.findOne({ productId });
    const isAuthentic = dbProduct && 
      dbProduct.blockchain.transactionHash === blockchainData.registrationTx;
    
    return {
      isAuthentic,
      product: {
        id: productId,
        farmer: blockchainData.farmer,
        cropType: blockchainData.cropType,
        quantity: blockchainData.quantity,
        harvestDate: new Date(parseInt(blockchainData.harvestDate) * 1000),
        metadata: JSON.parse(blockchainData.metadata)
      },
      supplyChain: history,
      certifications: await this.verifyCertifications(productId)
    };
  }

  async generateQRCode(productId) {
    const QRCode = require('qrcode');
    const verificationUrl = `${process.env.APP_URL}/verify/${productId}`;
    
    const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#2E7D32',
        light: '#FFFFFF'
      }
    });
    
    // Save QR code image
    const buffer = Buffer.from(qrCodeDataUrl.split(',')[1], 'base64');
    const filename = `qr_${productId}.png`;
    await s3Service.uploadFile(buffer, `qrcodes/${filename}`);
    
    return {
      dataUrl: qrCodeDataUrl,
      url: verificationUrl,
      s3Key: `qrcodes/${filename}`
    };
  }

  async createSmartContract(contractData) {
    const {
      buyerId,
      sellerId,
      productId,
      quantity,
      price,
      deliveryDate,
      qualityParameters
    } = contractData;
    
    const contractId = this.generateContractId();
    
    const tx = this.contract.methods.createContract(
      contractId,
      buyerId,
      sellerId,
      productId,
      quantity,
      this.web3.utils.toWei(price.toString(), 'ether'),
      deliveryDate.getTime(),
      JSON.stringify(qualityParameters)
    );
    
    const receipt = await this.sendTransaction(tx);
    
    // Store in database
    await SmartContract.create({
      contractId,
      buyerId,
      sellerId,
      productId,
      quantity,
      price,
      deliveryDate,
      qualityParameters,
      status: 'active',
      blockchain: {
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber
      }
    });
    
    // Notify parties
    await this.notifyContractParties(contractId, 'created');
    
    return {
      contractId,
      transactionHash: receipt.transactionHash
    };
  }

  async executeSmartContract(contractId, executionData) {
    const contract = await SmartContract.findOne({ contractId });
    
    // Verify quality parameters
    const qualityMet = await this.verifyQualityParameters(
      contract.qualityParameters,
      executionData.actualQuality
    );
    
    if (!qualityMet) {
      // Handle quality dispute
      return this.handleQualityDispute(contractId, executionData);
    }
    
    // Execute payment
    const tx = this.contract.methods.executeContract(
      contractId,
      qualityMet,
      JSON.stringify(executionData)
    );
    
    const receipt = await this.sendTransaction(tx);
    
    // Update status
    contract.status = 'executed';
    contract.executionData = executionData;
    contract.executionTx = receipt.transactionHash;
    await contract.save();
    
    // Transfer payment
    await this.processPayment(contract);
    
    return {
      success: true,
      transactionHash: receipt.transactionHash,
      paymentProcessed: true
    };
  }
}

module.exports = new SupplyChainBlockchain();