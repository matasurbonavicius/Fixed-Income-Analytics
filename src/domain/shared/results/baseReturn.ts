// Discriminated union with string errors
export type Result<T> =
  | { success: true; value: T }
  | { success: false; error: string };

/*
* Use ResultHelper.failure only on the first level of error, specify what happened
*
* Use add context on subsequent layers of the error, just add location
* 
* Domain: No context here. Math functions just re-pass valueObjects errors if anything,
*         it's still primary info
* 
* Application: Formulas: First context layer
* Application: Services: Second context layer
* Infrastructure: Third context layer
*/

export class ResultHelper {
  static success<T>(value: T): Result<T> {
    return { success: true, value };
  }

  static failure<T>(error: string): Result<T> {
    return { success: false, error };
  }

  static addContext<T>(result: Result<T>, context: string): Result<T> {
    if (result.success) return result;
    return { success: false, error: `${context} | ${result.error}` };
  }
}
