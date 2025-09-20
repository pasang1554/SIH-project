// services/communityService.js
const mongoose = require('mongoose');
const redis = require('redis');
const { EventEmitter } = require('events');

class CommunityService extends EventEmitter {
  constructor() {
    super();
    this.redisClient = redis.createClient({
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT
    });
    
    this.initializeSchemas();
    this.setupEventHandlers();
  }

  initializeSchemas() {
    // Discussion Forum Schema
    this.Discussion = mongoose.model('Discussion', new mongoose.Schema({
      author: { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer', required: true },
      title: { type: String, required: true },
      content: { type: String, required: true },
      category: { 
        type: String, 
        enum: ['crop_management', 'pest_control', 'market', 'technology', 'general'],
        required: true 
      },
      tags: [String],
      images: [String],
      location: {
        type: { type: String, default: 'Point' },
        coordinates: [Number]
      },
      upvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Farmer' }],
      views: { type: Number, default: 0 },
      isExpertVerified: { type: Boolean, default: false },
      expertNotes: String,
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    }));

    // Success Story Schema
    this.SuccessStory = mongoose.model('SuccessStory', new mongoose.Schema({
      farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer', required: true },
      title: { type: String, required: true },
      story: { type: String, required: true },
      beforeMetrics: {
        yield: Number,
        income: Number,
        challenges: [String]
      },
      afterMetrics: {
        yield: Number,
        income: Number,
        improvements: [String]
      },
      techniques: [String],
      images: {
        before: [String],
        after: [String]
      },
      video: String,
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Expert' },
      featured: { type: Boolean, default: false },
      inspirationScore: { type: Number, default: 0 },
      createdAt: { type: Date, default: Date.now }
    }));

    // Local Expert Schema
    this.LocalExpert = mongoose.model('LocalExpert', new mongoose.Schema({
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      expertise: [String],
      experience: Number, // years
      location: {
        type: { type: String, default: 'Point' },
        coordinates: [Number]
      },
      serviceArea: { type: Number, default: 50 }, // km radius
      languages: [String],
      availability: {
        days: [String],
        hours: { start: String, end: String }
      },
      rating: { type: Number, default: 0 },
      consultations: { type: Number, default: 0 },
      verified: { type: Boolean, default: false },
      certifications: [String]
    }));

    // Knowledge Base Schema
    this.KnowledgeArticle = mongoose.model('KnowledgeArticle', new mongoose.Schema({
      title: { type: String, required: true },
      content: { type: String, required: true },
      category: String,
      tags: [String],
      author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      language: { type: String, default: 'en' },
      translations: [{
        language: String,
        title: String,
        content: String
      }],
      media: {
        images: [String],
        videos: [String],
        documents: [String]
      },
      difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'] },
      readTime: Number, // minutes
      views: { type: Number, default: 0 },
      helpful: { type: Number, default: 0 },
      lastUpdated: { type: Date, default: Date.now }
    }));
  }

  async createDiscussion(farmerId, discussionData) {
    const discussion = new this.Discussion({
      author: farmerId,
      ...discussionData
    });
    
    await discussion.save();
    
    // Notify nearby farmers
    await this.notifyNearbyFarmers(discussion);
    
    // Check for expert attention needed
    if (this.requiresExpertAttention(discussionData)) {
      await this.notifyExperts(discussion);
    }
    
    // Index for search
    await this.indexContent(discussion);
    
    return discussion;
  }

  async notifyNearbyFarmers(discussion) {
    if (!discussion.location || !discussion.location.coordinates) return;
    
    const nearbyFarmers = await Farmer.find({
      location: {
        $near: {
          $geometry: discussion.location,
          $maxDistance: 50000 // 50km
        }
      },
      _id: { $ne: discussion.author }
    }).limit(100);
    
    const notification = {
      title: 'New Discussion in Your Area',
      body: discussion.title,
      data: {
        type: 'discussion',
        discussionId: discussion._id
      }
    };
    
    for (const farmer of nearbyFarmers) {
      await notificationService.sendNotification(farmer._id, notification, {
        channels: ['push', 'inApp']
      });
    }
  }

  async shareSuccessStory(farmerId, storyData) {
    const story = new this.SuccessStory({
      farmer: farmerId,
      ...storyData
    });
    
    // Calculate improvement metrics
    story.inspirationScore = this.calculateInspirationScore(storyData);
    
    await story.save();
    
    // Create a discussion thread for the story
    const discussion = await this.createDiscussion(farmerId, {
      title: `Success Story: ${storyData.title}`,
      content: `I wanted to share my success story with the community. ${storyData.story.substring(0, 200)}...`,
      category: 'general',
      tags: ['success_story', ...storyData.techniques]
    });
    
    // Feature if highly inspirational
    if (story.inspirationScore > 80) {
      story.featured = true;
      await story.save();
      
      // Notify all farmers in the region
      await this.broadcastSuccessStory(story);
    }
    
    return story;
  }

  calculateInspirationScore(storyData) {
    let score = 0;
    
    // Yield improvement
    const yieldImprovement = ((storyData.afterMetrics.yield - storyData.beforeMetrics.yield) / 
                             storyData.beforeMetrics.yield) * 100;
    score += Math.min(yieldImprovement, 50);
    
    // Income improvement
    const incomeImprovement = ((storyData.afterMetrics.income - storyData.beforeMetrics.income) / 
                              storyData.beforeMetrics.income) * 100;
    score += Math.min(incomeImprovement / 2, 30);
    
    // Innovation factor
    if (storyData.techniques.length > 3) score += 10;
    if (storyData.techniques.some(t => t.includes('organic'))) score += 5;
    if (storyData.techniques.some(t => t.includes('water_saving'))) score += 5;
    
    return Math.min(score, 100);
  }

  async connectWithExpert(farmerId, query) {
    const farmer = await Farmer.findById(farmerId);
    
    // Find suitable experts
    const experts = await this.LocalExpert.find({
      location: {
        $near: {
          $geometry: farmer.location,
          $maxDistance: 50000 // 50km
        }
      },
      expertise: { $in: query.topics },
      languages: { $in: [farmer.language] },
      verified: true
    }).sort({ rating: -1, consultations: -1 }).limit(5);
    
    if (experts.length === 0) {
      // Fallback to online consultation
      return this.scheduleOnlineConsultation(farmerId, query);
    }
    
    // Create consultation request
    const consultation = await this.createConsultation({
      farmer: farmerId,
      expert: experts[0]._id,
      query: query.description,
      preferredTime: query.preferredTime,
      mode: query.mode || 'phone'
    });
    
    return {
      consultation,
      expert: experts[0],
      alternativeExperts: experts.slice(1)
    };
  }

  async createKnowledgeBase() {
    // Aggregate successful discussions and solutions
    const valuableDiscussions = await this.Discussion.find({
      isExpertVerified: true,
      upvotes: { $size: { $gte: 10 } }
    }).populate('author');
    
    for (const discussion of valuableDiscussions) {
      // Check if already in knowledge base
      const exists = await this.KnowledgeArticle.findOne({
        'source.discussionId': discussion._id
      });
      
      if (!exists) {
        // Create knowledge article
        const article = new this.KnowledgeArticle({
          title: discussion.title,
          content: await this.enrichContent(discussion),
          category: discussion.category,
          tags: discussion.tags,
          author: discussion.author._id,
          source: {
            type: 'discussion',
            discussionId: discussion._id
          }
        });
        
        // Auto-translate to major languages
        await this.translateArticle(article);
        
        await article.save();
      }
    }
  }

  async searchCommunityContent(query, filters = {}) {
    const searchResults = {
      discussions: [],
      successStories: [],
      experts: [],
      knowledge: []
    };
    
    // Search discussions
        searchResults.discussions = await this.Discussion.find({
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { content: { $regex: query, $options: 'i' } },
        { tags: { $in: query.split(' ') } }
      ],
      ...filters
    })
    .populate('author', 'name location')
    .sort({ upvotes: -1, createdAt: -1 })
    .limit(10);
    
    // Search success stories
    searchResults.successStories = await this.SuccessStory.find({
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { story: { $regex: query, $options: 'i' } },
        { techniques: { $in: query.split(' ') } }
      ]
    })
    .populate('farmer', 'name location')
    .sort({ inspirationScore: -1 })
    .limit(5);
    
    // Search experts
    if (filters.needExpert) {
      searchResults.experts = await this.LocalExpert.find({
        expertise: { $in: query.split(' ') },
        verified: true
      })
      .populate('user', 'name')
      .sort({ rating: -1 })
      .limit(5);
    }
    
    // Search knowledge base
    searchResults.knowledge = await this.KnowledgeArticle.find({
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { content: { $regex: query, $options: 'i' } },
        { tags: { $in: query.split(' ') } }
      ],
      language: filters.language || 'en'
    })
    .sort({ helpful: -1, views: -1 })
    .limit(10);
    
    // Rank results by relevance
    return this.rankSearchResults(searchResults, query);
  }

  async gamifyParticipation(farmerId) {
    const farmer = await Farmer.findById(farmerId);
    
    // Calculate participation score
    const activities = {
      discussions: await this.Discussion.countDocuments({ author: farmerId }),
      solutions: await this.Discussion.countDocuments({ 
        'replies.author': farmerId,
        'replies.isAcceptedSolution': true 
      }),
      successStories: await this.SuccessStory.countDocuments({ farmer: farmerId }),
      helpfulVotes: await this.calculateHelpfulVotes(farmerId)
    };
    
    // Award badges
    const badges = [];
    
    if (activities.discussions >= 10) badges.push('Active Contributor');
    if (activities.solutions >= 5) badges.push('Problem Solver');
    if (activities.successStories >= 1) badges.push('Success Story Teller');
    if (activities.helpfulVotes >= 50) badges.push('Community Helper');
    
    // Calculate level
    const totalPoints = 
      activities.discussions * 10 +
      activities.solutions * 50 +
      activities.successStories * 100 +
      activities.helpfulVotes * 2;
    
    const level = Math.floor(Math.sqrt(totalPoints / 100));
    
    // Update farmer profile
    await Farmer.findByIdAndUpdate(farmerId, {
      communityProfile: {
        level,
        points: totalPoints,
        badges,
        activities
      }
    });
    
    return {
      level,
      points: totalPoints,
      badges,
      nextLevelPoints: Math.pow(level + 1, 2) * 100,
      activities
    };
  }
}

module.exports = new CommunityService();