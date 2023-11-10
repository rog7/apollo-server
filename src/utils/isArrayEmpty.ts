export const isArrayEmpty = (arr: string[]) => {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i].trim() !== "") {
      return false; // Non-empty string found
    }
  }
  return true; // Array contains only empty strings
};
