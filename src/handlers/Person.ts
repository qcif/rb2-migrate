import { Handler, HandlerBase } from './handlers';

const util = require('util');

export class Person extends HandlerBase implements Handler {

  crosswalk(o: Object): Object|undefined {
    const fullname = util.format("%s %s", o["foaf:givenName"], o["foaf:familyName"]);
    const honorific = o["foaf:title"];
    const output = {
      "dc:identifier": o["dc:identifier"],
      text_full_name: fullname,
      full_name_honorific: honorific + ' ' + fullname,
      email: o["foaf:email"],
      username: "",
      role: this.params["role"]
    };
    if( o["foaf:familyName"] ) {
      this.logger('handler', "Person", this.params["role"], "succeeded", JSON.stringify(output));
      if( !o["dc:identifier"] ) {
        this.logger('handler', "Person", this.params["role"], "warning", "No dc:identifier");
      }
      return output;
    } else {
      this.logger('handler', "Person", this.params["role"], "missing", "No foaf:familyName")
    }
    return undefined;
  }
}


