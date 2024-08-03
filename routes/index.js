import AppController from '../controllers/AppController';

const routeMapper = (app) => {
  app.get('/status', AppController.getStatus);
  app.get('/stats', AppController.getStats);
};

module.exports = routeMapper;
