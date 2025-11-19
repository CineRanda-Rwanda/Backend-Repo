import { Library, ILibrary } from '../models/library.model';
import { Purchase } from '../models/purchase.model';
import mongoose from 'mongoose';

export class LibraryRepository {
  /**
   * Add content to user's library
   */
  async addToLibrary(
    userId: string,
    contentId: string,
    contentType: 'Movie' | 'Series'
  ): Promise<ILibrary> {
    const libraryItem = await Library.create({
      userId: new mongoose.Types.ObjectId(userId),
      contentId: new mongoose.Types.ObjectId(contentId),
      contentType,
      addedAt: new Date()
    });

    return libraryItem;
  }

  /**
   * Check if content exists in user's library
   */
  async isInLibrary(userId: string, contentId: string): Promise<boolean> {
    const exists = await Library.exists({
      userId: new mongoose.Types.ObjectId(userId),
      contentId: new mongoose.Types.ObjectId(contentId)
    });

    return exists !== null;
  }

  /**
   * Remove content from user's library
   */
  async removeFromLibrary(userId: string, contentId: string): Promise<boolean> {
    const result = await Library.deleteOne({
      userId: new mongoose.Types.ObjectId(userId),
      contentId: new mongoose.Types.ObjectId(contentId)
    });

    return result.deletedCount > 0;
  }

  /**
   * Get user's library with pagination and filters
   */
  async getUserLibrary(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      contentType?: 'Movie' | 'Series';
      sortBy?: 'addedAt' | 'title';
      sortOrder?: 'asc' | 'desc';
    } = {}
  ) {
    const {
      page = 1,
      limit = 20,
      contentType,
      sortBy = 'addedAt',
      sortOrder = 'desc'
    } = options;

    const skip = (page - 1) * limit;

    // Build query
    const query: any = {
      userId: new mongoose.Types.ObjectId(userId)
    };

    if (contentType) {
      query.contentType = contentType;
    }

    // Build sort
    let sort: any = {};
    if (sortBy === 'addedAt') {
      sort.addedAt = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'title') {
      sort['content.title'] = sortOrder === 'asc' ? 1 : -1;
    }

    // Execute query with population
    const library = await Library.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'contentId',
        select: 'title contentType posterImageUrl duration releaseYear price averageRating isFree'
      })
      .lean();

    // Filter out items where content was deleted
    const validLibrary = library.filter((item: any) => item.contentId !== null && item.contentId !== undefined);
    
    const totalItems = validLibrary.length;

    // Get all content IDs to check purchase status
    const contentIds = validLibrary.map((item: any) => item.contentId._id);
    
    // Check which content items have been purchased
    const purchases = await Purchase.find({
      userId: new mongoose.Types.ObjectId(userId),
      contentId: { $in: contentIds },
      status: 'completed'
    }).select('contentId').lean();

    const purchasedContentIds = new Set(
      purchases.map((p: any) => p.contentId.toString())
    );

    return {
      library: validLibrary.map((item: any) => {
        const content = item.contentId;
        const isUnlocked = content.isFree || purchasedContentIds.has(content._id.toString());
        
        return {
          _id: item._id,
          content: {
            _id: content._id,
            title: content.title,
            contentType: content.contentType,
            posterImageUrl: content.posterImageUrl,
            duration: content.duration,
            releaseYear: content.releaseYear,
            price: content.price,
            averageRating: content.averageRating,
            isUnlocked
          },
          addedAt: item.addedAt
        };
      }),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit),
        totalItems: totalItems,
        limit
      }
    };
  }

  /**
   * Get library item count for user
   */
  async getLibraryCount(userId: string): Promise<number> {
    return await Library.countDocuments({
      userId: new mongoose.Types.ObjectId(userId)
    });
  }
}
