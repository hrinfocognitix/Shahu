# Academy API

All API endpoints begin with `/api/v1`. Send `Authorization: Bearer <access-token>` for protected operations.

| Resource | Endpoint | Write access |
| --- | --- | --- |
| Auth | `/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/logout` | Public except logout |
| Courses and subjects | `/courses`, `/subjects` | Admin |
| Content | `/materials`, `/notes`, `/question-papers`, `/videos`, `/gallery` | Admin / teacher |
| Academic operations | `/announcements`, `/calendar`, `/exams`, `/attendance` | Admin / teacher |
| People | `/teachers`, `/students`, `/users/me` | Admin / teacher |

Each collection resource supports `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, and `DELETE /:id` where authorized. List endpoints accept `page`, `limit`, `search`, `course`, `subject`, and `status` filters.
