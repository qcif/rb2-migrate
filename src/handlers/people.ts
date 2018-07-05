import { Handler, HandlerBase, LogCallback } from './handlers';
const util = require('util');


export class PeopleHandler extends HandlerBase implements Handler {

  crosswalk(o: Object): Object {
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
    this.logger('handler', "person", this.params["role"], "succeeded", JSON.stringify(output));
    return output;
  }
}


