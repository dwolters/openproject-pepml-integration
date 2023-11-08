import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import OpenProject from './modules/openproject';
import config from 'config'
import { exportProject } from './modules/openproject-neo-util';
import { closeConnection } from './modules/neo';
import { identifyCommonEntities } from './modules/merge';

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

identifyCommonEntities('PEPMLTemp', 'PEPMLDep').then(() => closeConnection());

// const port = 4000;
// app.listen(port, () => {
//   console.log(`Server is running on http://localhost:${port}`);
// });

//exportProject(3, 'OpenProjectModel').then(() => closeConnection());

//orm.getStatuses().then(statuses => console.log(statuses));
// console.log('start')
// orm.getTasks(3).then((tasks) => {
//   tasks.forEach(task => {
//     let workPackage = {
//       name: task.subject,
//       //type: payload.work_package._embedded.type.name,
//     }
//     console.log(workPackage);
//   })
// })
