import {Handler, HandlerBase} from './handlers';

export class RequestIdentifier extends HandlerBase implements Handler {

  crosswalk(o: Object): Object | undefined {
    const result = {};
    result[this.config["name"]] = ["request"];
    return result;
  }

}
