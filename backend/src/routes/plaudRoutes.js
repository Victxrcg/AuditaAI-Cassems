const plaudController = require('../controllers/plaudController');

const router = require('express').Router();

router.get('/config', plaudController.getConfig);
router.get('/workflow/:workflowId/result', plaudController.getWorkflowResult);
router.post('/create-from-workflow', plaudController.createFromWorkflow);

module.exports = router;
