// configure API URL
export const API_URL = "http://localhost:5006/api/";
// Primo API key is read from frontend/.env.local (REACT_APP_PRIMO_API_KEY); see frontend/.env.example
export const library_url = "https://api-na.hosted.exlibrisgroup.com/primo/v1/search?inst=01CASLS_REGINA&vid=01CASLS_REGINA:01CASLS_REGINA&tab=Everything&scope=MyInst_and_CI&apikey=" + (process.env.REACT_APP_PRIMO_API_KEY || "") + "&q=any,contains,";
export const doi_url = "https://public-api.thirdiron.com/public/v1/libraries/172/articles/doi/"
export const isbn_url = "https://proxy-na.hosted.exlibrisgroup.com/exl_rewrite/syndetics.com/index.php?client=primo&isbn="