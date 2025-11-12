import mongoose from 'mongoose';
import { Content } from '../data/models/movie.model';
import config from '../config';

const COINS_TO_RWF_RATE = 100; // 1 coin = 100 RWF

async function migratePrices() {
  try {
    // Connect to database
    await mongoose.connect(config.mongodb.uri);
    console.log('✅ Connected to database');

    // Find ALL content that has priceInCoins (regardless of priceInRwf status)
    const contents = await Content.find({
      priceInCoins: { $exists: true, $gt: 0 }
    });

    console.log(`Found ${contents.length} items with priceInCoins`);

    let updated = 0;
    let skipped = 0;

    for (const content of contents) {
      let needsUpdate = false;

      // Check if movie needs priceInRwf update
      if (content.priceInCoins && content.priceInCoins > 0) {
        const expectedRwf = content.priceInCoins * COINS_TO_RWF_RATE;
        
        if (!content.priceInRwf || content.priceInRwf !== expectedRwf) {
          content.priceInRwf = expectedRwf;
          needsUpdate = true;
          console.log(`📝 ${content.title}: ${content.priceInCoins} coins → ${expectedRwf} RWF`);
        }
      }

      // Check episodes for series
      if (content.contentType === 'Series' && content.seasons) {
        for (const season of content.seasons) {
          if (season.episodes) {
            for (const episode of season.episodes) {
              if (episode.priceInCoins && episode.priceInCoins > 0) {
                const expectedEpisodeRwf = episode.priceInCoins * COINS_TO_RWF_RATE;
                
                if (!episode.priceInRwf || episode.priceInRwf !== expectedEpisodeRwf) {
                  episode.priceInRwf = expectedEpisodeRwf;
                  needsUpdate = true;
                  console.log(`  📺 Episode ${episode.episodeNumber}: ${episode.priceInCoins} coins → ${expectedEpisodeRwf} RWF`);
                }
              }
            }
          }
        }
      }

      if (needsUpdate) {
        await content.save();
        updated++;
        console.log(`✅ Saved: ${content.title}\n`);
      } else {
        skipped++;
        console.log(`⏭️  Skipped: ${content.title} (already has correct prices)\n`);
      }
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log(`🎉 Migration complete!`);
    console.log(`   Updated: ${updated} items`);
    console.log(`   Skipped: ${skipped} items (already correct)`);
    console.log(`   Total:   ${contents.length} items`);
    console.log(`${'='.repeat(50)}\n`);
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run migration
migratePrices();