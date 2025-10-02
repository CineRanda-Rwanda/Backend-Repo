import { Category, ICategory } from '../models/category.model';
import { BaseRepository } from './base.repository';

export class CategoryRepository extends BaseRepository<ICategory> {
  constructor() {
    super(Category);
  }

  async getActiveCategories(): Promise<ICategory[]> {
    return Category.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
  }
  
  async getFeaturedCategories(): Promise<ICategory[]> {
    return Category.find({ isActive: true, isFeature: true }).sort({ sortOrder: 1, name: 1 });
  }
}