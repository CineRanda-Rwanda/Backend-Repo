import mongoose from 'mongoose';
import { Content } from '../data/models/movie.model';
import '../data/models/genre.model'; // Import to register the model
import '../data/models/category.model'; // Import to register the model
import config from '../config';

async function checkPrices() {
  try {
    await mongoose.connect(config.mongodb.uri);
    console.log('✅ Connected to database\n');

    const allMovies = await Content.find({ contentType: 'Movie' }).lean();
    const publishedMovies = await Content.find({ 
      contentType: 'Movie',
      isPublished: true 
    }).lean();
    
    console.log(`📊 Total movies: ${allMovies.length}`);
    console.log(`📊 Published movies: ${publishedMovies.length}\n`);
    
    console.log('='.repeat(60));
    console.log('PUBLISHED MOVIES (What API returns):');
    console.log('='.repeat(60));
    
    publishedMovies.forEach((movie: any) => {
      console.log(`\n📽️  ${movie.title}`);
      console.log(`   ID: ${movie._id}`);
      console.log(`   priceInCoins: ${movie.priceInCoins}`);
      console.log(`   priceInRwf: ${movie.priceInRwf}`);
      console.log(`   isPublished: ${movie.isPublished}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('UNPUBLISHED MOVIES:');
    console.log('='.repeat(60));
    
    const unpublishedMovies = allMovies.filter((m: any) => !m.isPublished);
    unpublishedMovies.forEach((movie: any) => {
      console.log(`\n📽️  ${movie.title}`);
      console.log(`   ID: ${movie._id}`);
      console.log(`   isPublished: ${movie.isPublished}`);
    });

    // NOW TEST THE EXACT QUERY YOUR API USES
    console.log('\n' + '='.repeat(60));
    console.log('TESTING EXACT API QUERY:');
    console.log('='.repeat(60));

    const queryObj = { contentType: 'Movie', isPublished: true };
    const apiMovies = await Content.find(queryObj)
      .sort({ createdAt: -1 })
      .skip(0)
      .limit(10)
      .select('title description posterImageUrl releaseYear priceInRwf priceInCoins genres categories')
      .populate('genres')
      .populate('categories')
      .lean(); // Using lean() to get plain objects

    console.log(`\nAPI Query returned ${apiMovies.length} movies:\n`);

    apiMovies.forEach((movie: any, index: number) => {
      console.log(`${index + 1}. ${movie.title}`);
      console.log(`   priceInCoins: ${movie.priceInCoins}`);
      console.log(`   priceInRwf: ${movie.priceInRwf}`);
      console.log(`   Has priceInRwf: ${movie.hasOwnProperty('priceInRwf')}`);
      console.log(`   Type of priceInRwf: ${typeof movie.priceInRwf}`);
      console.log('');
    });

    // Check the raw JSON
    console.log('='.repeat(60));
    console.log('RAW JSON OF FIRST MOVIE:');
    console.log('='.repeat(60));
    console.log(JSON.stringify(apiMovies[0], null, 2));

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

checkPrices();