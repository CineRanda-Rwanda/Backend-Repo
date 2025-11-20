import AWS from 'aws-sdk';
import config from '../src/config';

async function testUpload() {
  console.log('--- Starting S3 Upload Test (v2) ---');
  
  const { accessKeyId, secretAccessKey, region, s3Bucket } = config.aws;
  
  AWS.config.update({
    accessKeyId,
    secretAccessKey,
    region,
    httpOptions: { timeout: 5000 }
  });

  const s3 = new AWS.S3();

  try {
    console.log('Attempting to List Buckets...');
    const list = await s3.listBuckets().promise();
    console.log('✅ List Buckets successful:', list.Buckets?.map((b: any) => b.Name));
  } catch (err) {
    console.error('❌ List Buckets failed:', err);
  }

  const testFileName = 'test-upload-v2-' + Date.now() + '.txt';
  const fileContent = 'This is a test file to verify S3 connectivity with v2.';

  try {
    console.log(`Attempting to upload ${testFileName} to ${s3Bucket}...`);
    
    const response = await s3.putObject({
      Bucket: s3Bucket,
      Key: testFileName,
      Body: fileContent,
    }).promise();

    console.log('✅ Upload successful!');
    console.log('ETag:', response.ETag);
    
  } catch (error) {
    console.error('❌ Upload failed:', error);
  }
}

testUpload();
