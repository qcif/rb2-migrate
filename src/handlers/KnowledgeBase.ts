import {Handler, HandlerBase} from './handlers';
import * as _ from 'lodash';

export class KnowledgeBase extends HandlerBase implements Handler {

  crosswalk(o: Object): Object | undefined {
    let result = {};
    console.log(`incoming handler for knowledgeBase:`);
    console.dir(o);
    for (const dest of this.config['destinations']) {
      result[dest["to"]] = {};
      // _.each(o, function (value, key) {
      //   console.log(key);
      if (_.camelCase(o['source']) === 'knowledgeBase') {
        _.set(result[dest["to"]], o);
        // });
      }
      for (let toRemove of ['source, name', 'pathway', 'nextStep'])
      _.unset(result[dest["to"]], _.camelCase(toRemove));
    }
    console.log('returning knowledgeBase result...');
    console.dir(result);
    return result;
  }
}
