import {Handler, HandlerBase} from './handlers';
import * as _ from 'lodash';

export class Pathway extends HandlerBase implements Handler {

  crosswalk(o: Object): Object | undefined {
    console.log('incoming object is');
    console.dir(o);
    const result = {};
    for (const dest of this.config['destinations']) {
      result[dest["to"]] = {};
      _.each(o, function(value, key) {
        console.log(key);
        _.set(result, `${dest["to"]}.${key}`, {
          'content': value['content'],
          'nextStep' : value['nextStep'],
          'key': value['key'],
          'type': value['type']
        })
      });
    }
    return result;
  }
}
