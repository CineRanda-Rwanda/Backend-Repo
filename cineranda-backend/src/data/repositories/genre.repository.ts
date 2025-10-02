import { Genre, IGenre } from '../models/genre.model';
import { BaseRepository } from './base.repository';

export class GenreRepository extends BaseRepository<IGenre> {
  constructor() {
    super(Genre);
  }

  async getActiveGenres(): Promise<IGenre[]> {
    return Genre.find({ isActive: true }).sort({ name: 1 });
  }
}