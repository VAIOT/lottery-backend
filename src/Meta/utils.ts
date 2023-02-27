/* eslint-disable no-await-in-loop */
/**
 * Check if object property exist in array.
 * @function
 * @template T, V
 * @param {T} object - any object
 * @param {T[]<V extends T & PropertyKey>} properties - property to look for
 *
 * @returns boolean
 * */
function hasProperty<T, V extends T & PropertyKey>(object: T, properties: V[]): boolean {
	return (object) ? properties?.some((prop: V) => Object.prototype.hasOwnProperty.call(object, prop)) : false
}

/**
 * Simple sleep function
 * @param milliseconds The number of milliseconds to wait
*/
async function sleep(milliseconds: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(() => {
		  	resolve();
		}, milliseconds);
	});
}

/**
 * .every async alternative.
 * @param arr array of items to iterate through.
 * @param predicate fn used to evaluate the element.
 * @returns true if all elements evaluate to true, otherwise returns false.
 */
async function asyncEvery<T>(arr: T[], predicate: (values: T) => Promise<boolean>): Promise<boolean> {
	for (const e of arr) {
		if (!await predicate(e)) { return false }
	}
	return true;
};

export { hasProperty, sleep, asyncEvery }
