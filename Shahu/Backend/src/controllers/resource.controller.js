const asyncHandler = require('../utils/asyncHandler');
const apiResponse = require('../utils/apiResponse');
const resourceService = require('../services/resource.service');

function resourceController(
  Model,
  {
    populate = '',
    beforeList,
    canRead,
    beforeCreate,
    beforeUpdate,
    beforeRemove,
    beforePermanentRemove,
    afterCreate,
    defaultFilter = {},
  } = {}
) {
  return {
    list: asyncHandler(async (req, res) => {
      const accessFilter = beforeList ? await beforeList(req) : {};
      const { items, meta } = await resourceService.list(
        Model,
        { ...req.query, ...defaultFilter },
        populate,
        accessFilter
      );
      return apiResponse.success(res, { message: 'Resources fetched', data: items, meta });
    }),
    get: asyncHandler(async (req, res) => {
      const item = await resourceService.getById(Model, req.params.id, populate);
      if (canRead && !(await canRead(req, item)))
        return apiResponse.error(res, {
          statusCode: 403,
          message: 'You are not allowed to view this record',
        });
      return apiResponse.success(res, { message: 'Resource fetched', data: item });
    }),
    create: asyncHandler(async (req, res) => {
      const payload = beforeCreate ? await beforeCreate(req) : req.body;
      const item = await resourceService.create(Model, payload, req.user?._id);
      // Side effects (for example FCM) must never make a successfully-created
      // resource fail for the administrator.
      if (afterCreate) {
        Promise.resolve(afterCreate(item, req)).catch(() => {});
      }
      return apiResponse.success(res, {
        statusCode: 201,
        message: 'Resource created',
        data: item,
      });
    }),
    update: asyncHandler(async (req, res) => {
      const payload = beforeUpdate
        ? await beforeUpdate(req)
        : { ...req.body, updatedBy: req.user?._id };
      return apiResponse.success(res, {
        message: 'Resource updated',
        data: await resourceService.update(Model, req.params.id, payload),
      });
    }),
    remove: asyncHandler(async (req, res) => {
      const payload = beforeRemove ? await beforeRemove(req) : {};
      await resourceService.remove(Model, req.params.id, req.user?._id, payload);
      return apiResponse.success(res, { message: 'Resource deleted' });
    }),
    restore: asyncHandler(async (req, res) =>
      apiResponse.success(res, {
        message: 'Resource restored',
        data: await resourceService.restore(Model, req.params.id, req.user?._id),
      })
    ),
    permanentRemove: asyncHandler(async (req, res) => {
      if (beforePermanentRemove) await beforePermanentRemove(req);
      await resourceService.permanentRemove(Model, req.params.id);
      return apiResponse.success(res, { message: 'Resource permanently deleted' });
    }),
  };
}
module.exports = resourceController;
