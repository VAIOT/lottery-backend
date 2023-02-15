/**
 * Check if object property exist in array.
 *
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

export { hasProperty, sleep }
