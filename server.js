import express from 'express';
import routeMapper from './routes/index';

const port = process.env.PORT || 5000;
const app = express();

routeMapper(app);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
