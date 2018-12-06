export function isEmailValid(email: string) {

	const tester = /^[-!#$%&'*+\/0-9=?A-Z^_a-z{|}~](\.?[-!#$%&'*+\/0-9=?A-Z^_a-z`{|}~])*@[a-zA-Z0-9](-*\.?[a-zA-Z0-9])*\.[a-zA-Z](-?[a-zA-Z0-9])+$/;

	if (!email) {
		return false;
	}

	if (email.length > 254) {
		return false;
	}

	const valid = tester.test(email);
	if (!valid) {
		return false;
	}

	return true;
}

export function decodeEmail(email) {

	const atEncoded = RegExp('&#64;');
	if (atEncoded.test(email)) {
		let theEmail = email.split('&#64;');
		if (theEmail.length > 0) {
			return `${theEmail[0]}@${theEmail[1]}`;
		}
		else return email;
	} else return email;
}
