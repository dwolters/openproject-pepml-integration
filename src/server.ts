import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';

const app = express();
app.use(bodyParser.json());

app.all('/webhook', (req: Request, res: Response) => {
  const payload = req.body;
  let workPackage = {
    action: payload.action,
    name: payload.work_package.subject,
    type: payload.work_package._embedded.type.name,
    status: {
      id: payload.work_package._embedded.status.id,
      name: payload.work_package._embedded.status.name,
      isClosed: payload.work_package._embedded.status.isClosed
    }
  }
  // Process the webhook payload here
  console.log(workPackage);
  //console.log(JSON.stringify(payload));
  res.sendStatus(200);
});

const port = 4000;
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});