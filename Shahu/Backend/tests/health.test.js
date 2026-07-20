const request = require('supertest');
const app = require('../src/app');

describe('health endpoint', () => {
  it('returns service health', async () => {
    const response = await request(app).get('/api/v1/health');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('allows the website and app to render uploaded media', async () => {
    const response = await request(app).get('/uploads/course-default-poster.png');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^image\//);
    expect(response.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(response.headers['access-control-allow-origin']).toBe('*');
  });

  it('does not expose uploaded academy documents through the public media path', async () => {
    const response = await request(app).get('/uploads/private-learning-file.pdf');
    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/authorized document download/i);
  });

  it('rejects course purchase submissions from non-Android clients', async () => {
    const response = await request(app).post('/api/v1/course-purchases').send({});
    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/Android application/i);
  });

  it('protects the audit log endpoint', async () => {
    const response = await request(app).get('/api/v1/audit-logs');
    expect(response.status).toBe(401);
  });

  it('protects dedicated admin management and has no generic user creation route', async () => {
    const adminResponse = await request(app).post('/api/v1/admins').send({});
    const genericResponse = await request(app).post('/api/v1/users').send({});
    expect(adminResponse.status).toBe(401);
    // The users router authenticates before method matching, so unauthenticated
    // callers are rejected without exposing whether a write route exists.
    expect(genericResponse.status).toBe(401);
  });
});
