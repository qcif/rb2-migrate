import {Handler, HandlerBase} from './handlers';
const _ = require('lodash');

export class DefaultDataset extends HandlerBase implements Handler {

  crosswalk(o: Object): Object | undefined {
    return o;
  }
}
