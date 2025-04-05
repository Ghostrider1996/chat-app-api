const generateRandomId = (): string =>
    "xxxxx-xxxxx-xxxxx-xxxxx".replace(/x/g, () =>
      Math.floor(Math.random() * 20).toString(20)
    );
  
  export { generateRandomId };