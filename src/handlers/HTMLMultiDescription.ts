import {Handler, HandlerBase} from './handlers';
import * as _ from 'lodash';

export class HTMLMultiDescription extends HandlerBase implements Handler {

  crosswalk(o: Object): Object | undefined {
    const records = _.castArray(o);
    const record1 = _.pullAt(records, 0)[0];
    const result = {};

    result[this.config["name"]] = record1.text;
    for (const dest of this.config['destinations']) {
      result[dest["to"]] = records;
    }
    return result;
  }
}
