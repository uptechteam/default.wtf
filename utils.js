// Full list of Google Services subdomains - https://gist.github.com/abuvanth/b9fcbaf7c77c2954f96c6e556138ffe8
function isGoogleServiceUrl(url) {
  return /https?:\/\/.*(?:mail|drive|calendar|meet|docs|admin|photos|translate|keep|hangouts|chat|currents|maps|news|ads|ediscovery|jamboard|earth|travel|podcasts|classroom|business|myaccount|adsense|cloud|adwords|analytics)\.google\.co.*/i.test(
    url
  );
}
