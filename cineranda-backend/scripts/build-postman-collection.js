const fs = require('fs');
const path = require('path');

const BASE_URL_VARIABLE = '{{base_url}}';

const jsonBody = (data) => JSON.stringify(data, null, 2);

const hasBody = (method) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

const createUrl = (routePath) => {
  const cleaned = routePath.replace(/^\//, '');
  return {
    raw: `${BASE_URL_VARIABLE}/${cleaned}`,
    host: [BASE_URL_VARIABLE],
    path: cleaned.split('/'),
  };
};

const buildHeaders = ({ method, requiresAuth, requiresAdmin, customHeaders = [] }) => {
  const headers = [];
  if (requiresAdmin) {
    headers.push({ key: 'Authorization', value: 'Bearer {{admin_token}}' });
  } else if (requiresAuth) {
    headers.push({ key: 'Authorization', value: 'Bearer {{auth_token}}' });
  }
  if (hasBody(method)) {
    headers.push({ key: 'Content-Type', value: 'application/json' });
  }
  return headers.concat(customHeaders);
};

const buildBody = ({ method, body }) => {
  if (!hasBody(method) || !body) {
    return undefined;
  }
  return {
    mode: 'raw',
    raw: typeof body === 'string' ? body : jsonBody(body),
    options: {
      raw: {
        language: 'json',
      },
    },
  };
};

const clone = (value) => JSON.parse(JSON.stringify(value));

const buildResponseEntry = (request, example) => ({
  name: example.name,
  originalRequest: clone(request),
  status: example.status,
  code: example.code,
  _postman_previewlanguage: 'json',
  header: [
    {
      key: 'Content-Type',
      value: 'application/json',
    },
  ],
  body: typeof example.body === 'string' ? example.body : jsonBody(example.body),
});

const buildDefaultSuccess = (endpoint) => ({
  name: `${endpoint.name} Success`,
  status: endpoint.responseStatus || 'OK',
  code: endpoint.responseCode || 200,
  body: endpoint.sampleResponse || {
    status: 'success',
    message: `${endpoint.name} completed successfully`,
    data: endpoint.sampleResponseData || {
      reference: endpoint.path,
      method: endpoint.method,
    },
  },
});

const buildDefaultError = (endpoint) => {
  if (endpoint.errorExample) {
    return endpoint.errorExample;
  }

  if (endpoint.requiresAuth || endpoint.requiresAdmin) {
    return {
      name: `${endpoint.name} Unauthorized`,
      status: 'Unauthorized',
      code: 401,
      body: {
        status: 'error',
        message: 'Authentication token missing or invalid',
        data: {
          requiredRole: endpoint.requiresAdmin ? 'admin' : 'user',
          reference: endpoint.path,
        },
      },
    };
  }

  return {
    name: `${endpoint.name} Not Found`,
    status: 'Not Found',
    code: 404,
    body: {
      status: 'error',
      message: 'Requested record could not be located',
      data: {
        reference: endpoint.path,
      },
    },
  };
};

const buildResponses = (endpoint, request) => {
  const successExample = buildDefaultSuccess(endpoint);
  const errorExample = buildDefaultError(endpoint);
  const additionalExamples = endpoint.examples || [];

  const entries = [successExample, errorExample, ...additionalExamples];
  return entries.map((example) => buildResponseEntry(request, example));
};

const buildRequest = (endpoint) => {
  const request = {
    method: endpoint.method,
    header: buildHeaders(endpoint),
    url: createUrl(endpoint.path),
  };
  const body = buildBody(endpoint);
  if (body) {
    request.body = body;
  }
  return {
    name: endpoint.name,
    request,
    response: buildResponses(endpoint, request),
  };
};

const buildFolder = ({ name, description, endpoints }) => ({
  name,
  description,
  item: endpoints.map(buildRequest),
});

const folders = [
  {
    name: 'Auth',
    description: 'Authentication, registration, and profile management.',
    endpoints: [
      {
        name: 'Register User',
        method: 'POST',
        path: '/auth/register',
        body: { username: 'newuser', phoneNumber: '2507XXXXXXXX', pin: '1234' },
      },
      {
        name: 'Request Verification Code',
        method: 'POST',
        path: '/auth/request-verification',
        body: { phoneNumber: '2507XXXXXXXX' },
      },
      {
        name: 'Complete Registration',
        method: 'POST',
        path: '/auth/verify-registration',
        body: { phoneNumber: '2507XXXXXXXX', verificationCode: '123456' },
      },
      {
        name: 'Resend Verification Code',
        method: 'POST',
        path: '/auth/resend-code',
        body: { phoneNumber: '2507XXXXXXXX' },
      },
      {
        name: 'Login User',
        method: 'POST',
        path: '/auth/login',
        body: { phoneNumber: '2507XXXXXXXX', pin: '1234' },
      },
      {
        name: 'Admin Login',
        method: 'POST',
        path: '/auth/admin/login',
        body: { phoneNumber: '2507XXXXXXXX', password: 'StrongPass123!' },
      },
      {
        name: 'Admin Refresh Token',
        method: 'POST',
        path: '/auth/admin/refresh-token',
        body: { refreshToken: '{{admin_refresh_token}}' },
      },
      {
        name: 'Verify Phone',
        method: 'GET',
        path: '/auth/verify-phone',
      },
      {
        name: 'Forgot Password',
        method: 'POST',
        path: '/auth/forgot-password',
        body: { phoneNumber: '2507XXXXXXXX' },
      },
      {
        name: 'Reset Password',
        method: 'POST',
        path: '/auth/reset-password',
        body: { token: 'reset-token', newPassword: 'StrongPass123!' },
      },
      {
        name: 'Forgot PIN',
        method: 'POST',
        path: '/auth/forgot-pin',
        body: { phoneNumber: '2507XXXXXXXX' },
      },
      {
        name: 'Reset PIN',
        method: 'POST',
        path: '/auth/reset-pin',
        body: { token: 'pin-reset-token', newPin: '1234' },
      },
      {
        name: 'Authenticate 2FA',
        method: 'POST',
        path: '/auth/2fa/authenticate',
        body: { phoneNumber: '2507XXXXXXXX', code: '123456' },
      },
      {
        name: 'Authenticated Profile',
        method: 'GET',
        path: '/auth/profile',
        requiresAuth: true,
      },
      {
        name: 'Update Profile',
        method: 'PATCH',
        path: '/auth/profile',
        requiresAuth: true,
        body: { username: 'New Name', avatarUrl: 'https://cdn.cineranda/avatar.png' },
      },
      {
        name: 'Change PIN',
        method: 'POST',
        path: '/auth/change-pin',
        requiresAuth: true,
        body: { currentPin: '1234', newPin: '5678' },
      },
      {
        name: 'Change Password',
        method: 'POST',
        path: '/auth/change-password',
        requiresAuth: true,
        body: { currentPassword: 'OldPass123!', newPassword: 'NewPass456!' },
      },
      {
        name: 'Admin Change Password',
        method: 'POST',
        path: '/auth/admin/change-password',
        requiresAdmin: true,
        body: { currentPassword: 'OldPass123!', newPassword: 'NewAdminPass456!' },
      },
      {
        name: 'Setup 2FA',
        method: 'POST',
        path: '/auth/2fa/setup',
        requiresAuth: true,
        body: { method: 'authenticator' },
      },
      {
        name: 'Verify 2FA Setup',
        method: 'POST',
        path: '/auth/2fa/verify',
        requiresAuth: true,
        body: { code: '123456' },
      },
    ],
  },
  {
    name: 'Content',
    description: 'Content discovery, playback, and administration.',
    endpoints: [
      {
        name: 'Admin Batch Toggle Ratings',
        method: 'PATCH',
        path: '/content/admin/batch-ratings',
        requiresAdmin: true,
        body: { contentIds: ['contentId1'], enabled: true },
      },
      {
        name: 'Admin Toggle Ratings',
        method: 'PATCH',
        path: '/content/admin/:id/ratings',
        requiresAdmin: true,
        body: { enabled: true },
      },
      {
        name: 'Admin Movies List',
        method: 'GET',
        path: '/content/admin/movies',
        requiresAdmin: true,
      },
      {
        name: 'Admin Series List',
        method: 'GET',
        path: '/content/admin/series',
        requiresAdmin: true,
      },
      {
        name: 'Admin Series Detail',
        method: 'GET',
        path: '/content/admin/series/:id',
        requiresAdmin: true,
      },
      {
        name: 'Search Content',
        method: 'GET',
        path: '/content/search',
      },
      {
        name: 'Get Unlocked Content',
        method: 'GET',
        path: '/content/unlocked',
        requiresAuth: true,
      },
      {
        name: 'Featured Movies',
        method: 'GET',
        path: '/content/public/featured',
      },
      {
        name: 'Content By Type',
        method: 'GET',
        path: '/content/public/type/:contentType',
      },
      {
        name: 'Movies By Genre',
        method: 'GET',
        path: '/content/public/movies/genre/:genreId',
      },
      {
        name: 'Movies By Category',
        method: 'GET',
        path: '/content/public/movies/category/:categoryId',
      },
      {
        name: 'All Public Movies',
        method: 'GET',
        path: '/content/public/movies',
      },
      {
        name: 'Movie Trailer',
        method: 'GET',
        path: '/content/movies/:id/trailer',
      },
      {
        name: 'Episode Trailer',
        method: 'GET',
        path: '/content/series/:seriesId/seasons/:seasonNumber/episodes/:episodeId/trailer',
      },
      {
        name: 'Season Details',
        method: 'GET',
        path: '/content/series/:contentId/seasons/:seasonNumber',
      },
      {
        name: 'Episode Details',
        method: 'GET',
        path: '/content/series/:contentId/episodes/:episodeId',
      },
      {
        name: 'Series Details',
        method: 'GET',
        path: '/content/series/:contentId',
      },
      {
        name: 'All Content (Admin)',
        method: 'GET',
        path: '/content',
        requiresAdmin: true,
      },
      {
        name: 'Movie Details',
        method: 'GET',
        path: '/content/:contentId',
      },
      {
        name: 'Check Access',
        method: 'GET',
        path: '/content/:contentId/access',
        requiresAuth: true,
      },
      {
        name: 'Watch Content',
        method: 'GET',
        path: '/content/:contentId/watch',
        requiresAuth: true,
      },
      {
        name: 'Watch Episode',
        method: 'GET',
        path: '/content/series/:contentId/episodes/:episodeId/watch',
        requiresAuth: true,
      },
      {
        name: 'Admin Content Detail',
        method: 'GET',
        path: '/content/admin/content/:id',
        requiresAdmin: true,
      },
      {
        name: 'Create Content',
        method: 'POST',
        path: '/content',
        requiresAdmin: true,
        body: { title: 'New Movie', contentType: 'movie', description: 'Synopsis', price: 1000 },
      },
      {
        name: 'Add Season',
        method: 'POST',
        path: '/content/:contentId/seasons',
        requiresAdmin: true,
        body: { seasonNumber: 1, label: 'Season 1' },
      },
      {
        name: 'Update Content',
        method: 'PATCH',
        path: '/content/:id',
        requiresAdmin: true,
        body: { title: 'Updated Title' },
      },
      {
        name: 'Delete Content',
        method: 'DELETE',
        path: '/content/:id',
        requiresAdmin: true,
      },
      {
        name: 'Add Episode',
        method: 'POST',
        path: '/content/:contentId/seasons/:seasonId/episodes',
        requiresAdmin: true,
        body: { title: 'Episode 1', duration: 3600 },
      },
      {
        name: 'Update Episode',
        method: 'PATCH',
        path: '/content/:contentId/seasons/:seasonId/episodes/:episodeId',
        requiresAdmin: true,
        body: { title: 'Episode 1 - Updated' },
      },
      {
        name: 'Delete Episode',
        method: 'DELETE',
        path: '/content/:contentId/seasons/:seasonId/episodes/:episodeId',
        requiresAdmin: true,
      },
      {
        name: 'Toggle Publish Status',
        method: 'PATCH',
        path: '/content/:id/publish-status',
        requiresAdmin: true,
        body: { published: true },
      },
    ],
  },
  {
    name: 'Payments',
    description: 'Wallet top-ups and purchase flows.',
    endpoints: [
      {
        name: 'Top-up Wallet',
        method: 'POST',
        path: '/payments/wallet/topup',
        requiresAuth: true,
        body: { amount: 3000, provider: 'flutterwave' },
      },
      {
        name: 'Wallet Balance',
        method: 'GET',
        path: '/payments/wallet/balance',
        requiresAuth: true,
      },
      {
        name: 'Initiate Content Purchase',
        method: 'POST',
        path: '/payments/content/purchase',
        requiresAuth: true,
        body: { contentId: 'contentId', paymentMethod: 'card' },
      },
      {
        name: 'Purchase Content With Wallet',
        method: 'POST',
        path: '/payments/content/purchase/wallet',
        requiresAuth: true,
        body: { contentId: 'contentId' },
      },
      {
        name: 'Purchase Season With Wallet',
        method: 'POST',
        path: '/payments/season/purchase/wallet',
        requiresAuth: true,
        body: { contentId: 'seriesId', seasonId: 'seasonId' },
      },
      {
        name: 'Purchase Episode With Wallet',
        method: 'POST',
        path: '/payments/episode/purchase/wallet',
        requiresAuth: true,
        body: { contentId: 'seriesId', episodeId: 'episodeId' },
      },
      {
        name: 'Purchase History',
        method: 'GET',
        path: '/payments/history',
        requiresAuth: true,
      },
      {
        name: 'Payment Callback',
        method: 'GET',
        path: '/payments/callback',
      },
      {
        name: 'Payment Webhook',
        method: 'POST',
        path: '/payments/webhook',
        body: { event: 'payment.success', data: {} },
      },
    ],
  },
  {
    name: 'Users',
    description: 'Admin-level user management.',
    endpoints: [
      {
        name: 'Find User By Phone',
        method: 'GET',
        path: '/users/by-phone',
        requiresAdmin: true,
      },
      {
        name: 'All Users',
        method: 'GET',
        path: '/users',
        requiresAdmin: true,
      },
      {
        name: 'Get User By ID',
        method: 'GET',
        path: '/users/:id',
        requiresAdmin: true,
      },
      {
        name: 'Update User',
        method: 'PUT',
        path: '/users/:id',
        requiresAdmin: true,
        body: { username: 'Updated User', status: 'active' },
      },
      {
        name: 'Update User Role',
        method: 'PATCH',
        path: '/users/:id/role',
        requiresAdmin: true,
        body: { role: 'admin' },
      },
      {
        name: 'Toggle User Status',
        method: 'PATCH',
        path: '/users/:id/status',
        requiresAdmin: true,
        body: { status: 'suspended' },
      },
      {
        name: 'Reset User PIN',
        method: 'POST',
        path: '/users/:id/reset-pin',
        requiresAdmin: true,
      },
      {
        name: 'Adjust Legacy Coins',
        method: 'POST',
        path: '/users/:id/coins',
        requiresAdmin: true,
        body: { amount: 100 },
      },
      {
        name: 'Adjust Wallet Balance',
        method: 'POST',
        path: '/users/:id/adjust-balance',
        requiresAdmin: true,
        body: { amount: 1000, reason: 'Compensation' },
      },
      {
        name: 'User Transactions',
        method: 'GET',
        path: '/users/:id/transactions',
        requiresAdmin: true,
      },
      {
        name: 'Delete User',
        method: 'DELETE',
        path: '/users/:id',
        requiresAdmin: true,
      },
    ],
  },
  {
    name: 'Admin',
    description: 'Dedicated admin helper endpoints.',
    endpoints: [
      {
        name: 'Create Admin User',
        method: 'POST',
        path: '/admin/users/create-admin',
        requiresAdmin: true,
        body: { phoneNumber: '2507XXXXXXXX', password: 'AdminPass123!', role: 'admin' },
      },
      {
        name: 'Grant Free Access',
        method: 'POST',
        path: '/admin/users/grant-access',
        requiresAdmin: true,
        body: { userId: 'userId', contentId: 'contentId', expiresAt: '2025-12-01T00:00:00Z' },
      },
      {
        name: 'Admin Analytics Dashboard',
        method: 'GET',
        path: '/admin/analytics/dashboard',
        requiresAdmin: true,
      },
    ],
  },
  {
    name: 'Analytics',
    description: 'Advanced analytics endpoints mounted under /admin/analytics.',
    endpoints: [
      {
        name: 'Dashboard Summary',
        method: 'GET',
        path: '/admin/analytics/dashboard',
        requiresAdmin: true,
      },
      {
        name: 'Revenue Analytics',
        method: 'GET',
        path: '/admin/analytics/revenue',
        requiresAdmin: true,
      },
      {
        name: 'User Growth Analytics',
        method: 'GET',
        path: '/admin/analytics/user-growth',
        requiresAdmin: true,
      },
      {
        name: 'Content Performance Analytics',
        method: 'GET',
        path: '/admin/analytics/content-performance',
        requiresAdmin: true,
      },
      {
        name: 'Wallet Stats',
        method: 'GET',
        path: '/admin/analytics/wallet-stats',
        requiresAdmin: true,
      },
      {
        name: 'Platform Health',
        method: 'GET',
        path: '/admin/analytics/platform-health',
        requiresAdmin: true,
      },
    ],
  },
  {
    name: 'Settings',
    description: 'Platform-wide settings management.',
    endpoints: [
      {
        name: 'Get Settings',
        method: 'GET',
        path: '/settings',
        requiresAdmin: true,
      },
      {
        name: 'Update Settings',
        method: 'PATCH',
        path: '/settings',
        requiresAdmin: true,
        body: { welcomeBonus: 500, currency: 'RWF' },
      },
    ],
  },
  {
    name: 'Verification',
    description: 'Phone verification utilities.',
    endpoints: [
      {
        name: 'Send Verification Code',
        method: 'POST',
        path: '/verification/send-code',
        requiresAuth: true,
        body: { phoneNumber: '2507XXXXXXXX' },
      },
      {
        name: 'Verify Code',
        method: 'POST',
        path: '/verification/verify',
        requiresAuth: true,
        body: { code: '123456' },
      },
    ],
  },
  {
    name: 'Genres',
    description: 'Genre catalog management.',
    endpoints: [
      {
        name: 'List Genres',
        method: 'GET',
        path: '/genres',
      },
      {
        name: 'Create Genre',
        method: 'POST',
        path: '/genres',
        requiresAdmin: true,
        body: { name: 'Drama' },
      },
      {
        name: 'Update Genre',
        method: 'PATCH',
        path: '/genres/:id',
        requiresAdmin: true,
        body: { name: 'Romantic Drama' },
      },
      {
        name: 'Delete Genre',
        method: 'DELETE',
        path: '/genres/:id',
        requiresAdmin: true,
      },
    ],
  },
  {
    name: 'Categories',
    description: 'Category catalog management.',
    endpoints: [
      {
        name: 'List Categories',
        method: 'GET',
        path: '/categories',
      },
      {
        name: 'Featured Categories',
        method: 'GET',
        path: '/categories/featured',
      },
      {
        name: 'Create Category',
        method: 'POST',
        path: '/categories',
        requiresAdmin: true,
        body: { name: 'Premium' },
      },
      {
        name: 'Update Category',
        method: 'PATCH',
        path: '/categories/:id',
        requiresAdmin: true,
        body: { name: 'Family' },
      },
      {
        name: 'Delete Category',
        method: 'DELETE',
        path: '/categories/:id',
        requiresAdmin: true,
      },
    ],
  },
  {
    name: 'Favorites',
    description: 'Manage personal favorites.',
    endpoints: [
      {
        name: 'List Favorites',
        method: 'GET',
        path: '/favorites',
        requiresAuth: true,
      },
      {
        name: 'Add Favorite',
        method: 'POST',
        path: '/favorites',
        requiresAuth: true,
        body: { contentId: 'contentId' },
      },
      {
        name: 'Remove Favorite',
        method: 'DELETE',
        path: '/favorites/:movieId',
        requiresAuth: true,
      },
      {
        name: 'Check Favorite Status',
        method: 'GET',
        path: '/favorites/check/:movieId',
        requiresAuth: true,
      },
    ],
  },
  {
    name: 'Library',
    description: 'User personal library.',
    endpoints: [
      {
        name: 'Add To Library',
        method: 'POST',
        path: '/library',
        requiresAuth: true,
        body: { contentId: 'contentId' },
      },
      {
        name: 'List Library Items',
        method: 'GET',
        path: '/library',
        requiresAuth: true,
      },
      {
        name: 'Remove From Library',
        method: 'DELETE',
        path: '/library/:contentId',
        requiresAuth: true,
      },
    ],
  },
  {
    name: 'Ratings',
    description: 'Movie/series ratings.',
    endpoints: [
      {
        name: 'Get Ratings For Content',
        method: 'GET',
        path: '/ratings/:contentId',
      },
      {
        name: 'Submit Rating',
        method: 'POST',
        path: '/ratings',
        requiresAuth: true,
        body: { contentId: 'contentId', rating: 4, review: 'Great!' },
      },
      {
        name: 'Delete Rating',
        method: 'DELETE',
        path: '/ratings/:ratingId',
        requiresAuth: true,
      },
    ],
  },
  {
    name: 'Watch Progress',
    description: 'Continue watching tracking.',
    endpoints: [
      {
        name: 'Save Progress',
        method: 'POST',
        path: '/watch-progress',
        requiresAuth: true,
        body: { contentId: 'contentId', progress: 1200 },
      },
      {
        name: 'Continue Watching List',
        method: 'GET',
        path: '/watch-progress',
        requiresAuth: true,
      },
      {
        name: 'Progress For Content',
        method: 'GET',
        path: '/watch-progress/:contentId',
        requiresAuth: true,
      },
    ],
  },
  {
    name: 'Watch History',
    description: 'Watch history management.',
    endpoints: [
      {
        name: 'User Watch History',
        method: 'GET',
        path: '/watch-history',
        requiresAuth: true,
      },
      {
        name: 'In-progress Movies',
        method: 'GET',
        path: '/watch-history/in-progress',
        requiresAuth: true,
      },
      {
        name: 'Update Watch Progress',
        method: 'POST',
        path: '/watch-history/update',
        requiresAuth: true,
        body: { contentId: 'contentId', watchedSeconds: 3600 },
      },
    ],
  },
  {
    name: 'Notifications',
    description: 'Notification center for both admins and end-users.',
    endpoints: [
      {
        name: 'Send Notification (Admin)',
        method: 'POST',
        path: '/notifications/admin/send',
        requiresAdmin: true,
        body: { title: 'Promo', message: 'New content available', audience: 'all' },
      },
      {
        name: 'Notification History (Admin)',
        method: 'GET',
        path: '/notifications/admin/history',
        requiresAdmin: true,
      },
      {
        name: 'User Notifications',
        method: 'GET',
        path: '/notifications',
        requiresAuth: true,
      },
      {
        name: 'Mark Notification As Read',
        method: 'PUT',
        path: '/notifications/:notificationId/read',
        requiresAuth: true,
      },
      {
        name: 'Mark All Notifications Read',
        method: 'PUT',
        path: '/notifications/read-all',
        requiresAuth: true,
      },
      {
        name: 'Delete Notification',
        method: 'DELETE',
        path: '/notifications/:notificationId',
        requiresAuth: true,
      },
    ],
  },
];

const collection = {
  info: {
    _postman_id: 'cineranda-complete-api',
    name: 'Cineranda API (Complete)',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  item: folders.map(buildFolder),
  variable: [
    { key: 'base_url', value: 'http://localhost:5000/api/v1' },
    { key: 'auth_token', value: '' },
    { key: 'admin_token', value: '' },
    { key: 'admin_refresh_token', value: '' },
  ],
};

const targetPath = path.resolve(__dirname, '..', 'cineranda API.postman_collection (4).json');
fs.writeFileSync(targetPath, JSON.stringify(collection, null, 2));
console.log(`Postman collection written to ${targetPath}`);
