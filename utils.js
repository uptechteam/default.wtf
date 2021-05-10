function isGoogleServiceUrl(url) {
  return /https?:\/\/.*(?:mail|drive|calendar|meet|docs|admin|photos|translate|keep|hangouts|chat|currents|maps|news|ads|ediscovery|jamboard|earth|travel|podcasts|classroom|business|myaccount|adsense|cloud|adwords|analytics)\.google\.co.*/i.test(
    url
  );
}
