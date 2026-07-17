const request = require('supertest');
const app = require('../src/app');

describe('health endpoint', () => {
  it('returns service health', async () => {
    const response = await request(app).get('/api/v1/health');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
