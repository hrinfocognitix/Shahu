const asyncHandler = require('../utils/asyncHandler');
const apiResponse = require('../utils/apiResponse');
const resourceService = require('../services/resource.service');

function resourceController(Model, { populate = '', beforeCreate, beforeUpdate, beforeRemove, defaultFilter = {} } = {}) {
  return {
    list: asyncHandler(async (req, res) => {
      const { items, meta } = await resourceService.list(Model, { ...req.query, ...defaultFilter }, populate);
      return apiResponse.success(res, { message: 'Resources fetched', data: items, meta });
    }),
    get: asyncHandler(async (req, res) => apiResponse.success(res, { message: 'Resource fetched', data: await resourceService.getById(Model, req.params.id, populate) })),
    create: asyncHandler(async (req, res) => {
      const payload = beforeCreate ? await beforeCreate(req) : req.body;
      return apiResponse.success(res, { statusCode: 201, message: 'Resource created', data: await resourceService.create(Model, payload, req.user?._id) });
    }),
    update: asyncHandler(async (req, res) => {
      const payload = beforeUpdate ? await beforeUpdate(req) : { ...req.body, updatedBy: req.user?._id };
      return apiResponse.success(res, { message: 'Resource updated', data: await resourceService.update(Model, req.params.id, payload) });
    }),
    remove: asyncHandler(async (req, res) => {
      const payload = beforeRemove ? await beforeRemove(req) : {};
      await resourceService.remove(Model, req.params.id, req.user?._id, payload);
      return apiResponse.success(res, { message: 'Resource deleted' });
    }),
    restore: asyncHandler(async (req, res) => apiResponse.success(res, { message: 'Resource restored', data: await resourceService.restore(Model, req.params.id, req.user?._id) })),
    permanentRemove: asyncHandler(async (req, res) => {
      await resourceService.permanentRemove(Model, req.params.id);
      return apiResponse.success(res, { message: 'Resource permanently deleted' });
    })
  };
}
module.exports = resourceController;
