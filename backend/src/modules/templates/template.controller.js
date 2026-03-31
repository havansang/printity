const { asyncHandler } = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/response');
const templateService = require('./template.service');

const listTemplates = asyncHandler(async (req, res) => {
  const items = await templateService.listTemplates(req.query);
  sendSuccess(res, {
    message: 'Templates fetched successfully',
    data: { items },
  });
});

const getTemplate = asyncHandler(async (req, res) => {
  const template = await templateService.getTemplateById(req.params.id);
  sendSuccess(res, {
    message: 'Template fetched successfully',
    data: { template },
  });
});

const getTemplateRenderAudit = asyncHandler(async (req, res) => {
  const audit = await templateService.getTemplateRenderAuditById(req.params.id);
  sendSuccess(res, {
    message: 'Template render audit generated successfully',
    data: { audit },
  });
});

const updateTemplate = asyncHandler(async (req, res) => {
  const template = await templateService.updateTemplateById(req.params.id, req.body);
  sendSuccess(res, {
    message: 'Template updated successfully',
    data: { template },
  });
});

module.exports = {
  listTemplates,
  getTemplate,
  getTemplateRenderAudit,
  updateTemplate,
};
