import { Document } from 'mongoose';

export interface IRepository<T extends Document> {
  findAll(): Promise<T[]>;
  findById(id: string): Promise<T | null>;
  findOne(filter: object): Promise<T | null>;
  create(data: Partial<T>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
}