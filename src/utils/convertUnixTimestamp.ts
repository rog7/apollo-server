export const convertUnixTimestamp = (unixTimestamp: number) => {
  const date = new Date(unixTimestamp * 1000); // Convert from seconds to milliseconds
  const options: any = { year: "numeric", month: "long", day: "numeric" };
  return date.toLocaleDateString("en-US", options);
};
