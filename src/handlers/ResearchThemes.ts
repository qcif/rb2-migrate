import {Handler, HandlerBase} from './handlers';
import * as _ from 'lodash';

export class ResearchThemes extends HandlerBase implements Handler {

  crosswalk(o: Object): Object | undefined {
    let result = [];
    if ((_.isArray(o) && _.includes(["on", "true"])) || o == 'true' || o == 'on') {
      result.push(this.config["theme"]);
      // result[this.config["name"]] = o;
    }
    return result;
  }
}
