for (const location of ['g1493734', 'g293916']) {
  const url = `https://data.xotelo.com/api/list?location_key=${location}&offset=0&limit=30`;
  const response = await fetch(url, {signal: AbortSignal.timeout(20000), headers: {'User-Agent':'QualityFriend/1.0'}});
  const data = await response.json();
  console.log(JSON.stringify({location, status: response.status, error: data.error, count: data.result?.list?.length}, null, 2));
}
