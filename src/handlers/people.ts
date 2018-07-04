



function handle_person(logger: LogCallback, role:string, o: Object): Object {
  const fullname = util.format("%s %s", o["foaf:givenName"], o["foaf:familyName"]);
  const honorific = o["foaf:title"];
  const output = {
    "dc:identifier": o["dc:identifier"],
    text_full_name: fullname,
    full_name_honorific: honorific + ' ' + fullname,
    email: o["foaf:email"],
    username: "",
    role: role
  };
  logger('handler', "person", role, "succeeded", JSON.stringify(output));
  return output;
}


