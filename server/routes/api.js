const express = require('express');
const router = express.Router();

// Import controllers
const productController = require('../controllers/productController');
const simulatorController = require('../controllers/simulatorController');

// Product analysis routes
router.post('/analyze', productController.analyzeProduct);
router.get('/supported-stores', productController.getSupportedStores);

// Simulator routes
router.post('/simulate/start', simulatorController.startSimulation);
router.post('/simulate/stop', simulatorController.stopSimulation);
router.get('/simulate/status', simulatorController.getSimulationStatus);

// Demo data routes for testing
router.get('/demo/sample-urls', (req, res) => {
  res.json([
    'https://www.amazon.com/dp/B08N5WRWNW',
    'https://www.ebay.com/itm/123456789',
    'https://www.walmart.com/ip/12345678',
    'https://www.target.com/p/example-product',
    'https://www.bestbuy.com/site/product/12345'
  ]);
});

module.exports = router;