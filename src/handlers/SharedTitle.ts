import {Handler, HandlerBase} from './handlers';

export class SharedTitle extends HandlerBase implements Handler {

  crosswalk(o: Object): Object | undefined {
    const result = {};
    for (const dest of this.config['destinations']) {
      result[dest["to"]] = o;
    }
    return result;
  }

}
