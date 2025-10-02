import { Request, Response, NextFunction } from 'express';
import { CategoryRepository } from '../../data/repositories/category.repository';
import AppError from '../../utils/AppError';
import { AuthRequest } from '../../middleware/auth.middleware';

interface MongoError extends Error {
  code?: number;
}

export class CategoryController {
  private categoryRepository: CategoryRepository;

  constructor() {
    this.categoryRepository = new CategoryRepository();
  }

  // Get all categories (public)
  getAllCategories = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const categories = await this.categoryRepository.getActiveCategories();
      
      res.status(200).json({
        status: 'success',
        results: categories.length,
        data: { categories }
      });
    } catch (error) {
      next(error);
    }
  };

  // Get featured categories (for homepage)
  getFeaturedCategories = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const categories = await this.categoryRepository.getFeaturedCategories();
      
      res.status(200).json({
        status: 'success',
        results: categories.length,
        data: { categories }
      });
    } catch (error) {
      next(error);
    }
  };

  // Admin: Create category
  createCategory = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { name, description, isFeature, sortOrder } = req.body;
      
      if (!name) {
        return next(new AppError('Category name is required', 400));
      }

      const category = await this.categoryRepository.create({
        name,
        description,
        isActive: true,
        isFeature: isFeature || false,
        sortOrder: sortOrder || 0
      });

      res.status(201).json({
        status: 'success',
        data: { category }
      });
    } catch (error) {
      // Fix type checking for error
      if (error instanceof Error && (error as MongoError).code === 11000) {
        return next(new AppError('A category with that name already exists', 400));
      }
      next(error);
    }
  };

  // Admin: Update category
  updateCategory = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { name, description, isActive, isFeature, sortOrder } = req.body;

      const category = await this.categoryRepository.findById(id);
      
      if (!category) {
        return next(new AppError('Category not found', 404));
      }

      const updatedCategory = await this.categoryRepository.update(id, {
        name,
        description,
        isActive,
        isFeature,
        sortOrder
      });

      res.status(200).json({
        status: 'success',
        data: { category: updatedCategory }
      });
    } catch (error) {
      // Fix type checking for error
      if (error instanceof Error && (error as MongoError).code === 11000) {
        return next(new AppError('A category with that name already exists', 400));
      }
      next(error);
    }
  };

  // Admin: Delete category
  deleteCategory = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const category = await this.categoryRepository.findById(id);
      
      if (!category) {
        return next(new AppError('Category not found', 404));
      }

      await this.categoryRepository.delete(id);

      res.status(200).json({
        status: 'success',
        data: null
      });
    } catch (error) {
      next(error);
    }
  };
}