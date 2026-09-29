//====================================================
// 1. STUDY AREA
//====================================================

var srm = ee.Geometry.Polygon([
  [
    [80.038, 12.828],
    [80.052, 12.828],
    [80.052, 12.818],
    [80.038, 12.818]
  ]
]);

Map.centerObject(srm, 15);


//====================================================
// 2. LANDSAT 8 DATA
//====================================================

var image = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
  .filterBounds(srm)
  .filterDate('2025-03-01', '2025-06-30')
  .filter(ee.Filter.lt('CLOUD_COVER', 5))
  .median()
  .clip(srm);


//====================================================
// 3. SCALE RED AND NIR
//====================================================

var red = image.select('SR_B4')
  .multiply(0.0000275)
  .add(-0.2);

var nir = image.select('SR_B5')
  .multiply(0.0000275)
  .add(-0.2);


//====================================================
// 4. NDVI
//====================================================

var ndvi = nir.subtract(red)
  .divide(nir.add(red))
  .rename('NDVI');


//====================================================
// 5. LAND SURFACE TEMPERATURE
//====================================================

var lst = image.select('ST_B10')
  .multiply(0.00341802)
  .add(149.0)
  .subtract(273.15)
  .rename('LST_Celsius');


//====================================================
// 6. VISUALIZATION
//====================================================

var ndviVis = {
  min: 0,
  max: 0.9,
  palette: [
    'brown',
    'yellow',
    'lightgreen',
    '006400'
  ]
};

var lstVis = {
  min: 32,
  max: 46,
  palette: [
    '0000ff',
    '00ffff',
    '00ff00',
    'ffff00',
    'ff9900',
    'ff0000'
  ]
};

Map.addLayer(ndvi, ndviVis, 'NDVI');

Map.addLayer(lst, lstVis, 'LST (°C)');


//====================================================
// 7. NDVI STATISTICS
//====================================================

var ndviStats = ndvi.reduceRegion({
  reducer: ee.Reducer.minMax()
    .combine({
      reducer2: ee.Reducer.mean(),
      sharedInputs: true
    }),
  geometry: srm,
  scale: 30,
  maxPixels: 1e13
});

print('NDVI Statistics:', ndviStats);


//====================================================
// 8. LST STATISTICS
//====================================================

var lstStats = lst.reduceRegion({
  reducer: ee.Reducer.minMax()
    .combine({
      reducer2: ee.Reducer.mean(),
      sharedInputs: true
    }),
  geometry: srm,
  scale: 30,
  maxPixels: 1e13
});

print('LST Statistics:', lstStats);


//====================================================
// 9. LOW NDVI VS HIGH NDVI
//====================================================

var lowNDVI = ndvi.lt(0.2);

var highNDVI = ndvi.gt(0.5);


// Low NDVI temperature

var lowLST = lst
  .updateMask(lowNDVI)
  .reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: srm,
    scale: 30,
    maxPixels: 1e13
  });


// High NDVI temperature

var highLST = lst
  .updateMask(highNDVI)
  .reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: srm,
    scale: 30,
    maxPixels: 1e13
  });


print('Mean LST where NDVI < 0.2:', lowLST);

print('Mean LST where NDVI > 0.5:', highLST);


//====================================================
// 10. NDVI-LST CORRELATION
//====================================================

var combined = ndvi.addBands(lst);

var samples = combined.sample({
  region: srm,
  scale: 30,
  numPixels: 1000,
  geometries: false
});

var correlation = samples.reduceColumns({
  reducer: ee.Reducer.pearsonsCorrelation(),
  selectors: ['NDVI', 'LST_Celsius']
});

print('NDVI-LST Pearson correlation:', correlation);


//====================================================
// 11. SCATTER PLOT
//====================================================

var chart = ui.Chart.feature.byFeature(
  samples,
  'NDVI',
  ['LST_Celsius']
)
.setChartType('ScatterChart')
.setOptions({
  title: 'NDVI vs Land Surface Temperature',
  hAxis: {
    title: 'NDVI'
  },
  vAxis: {
    title: 'LST (°C)'
  },
  pointSize: 3,
  trendlines: {
    0: {
      color: 'red',
      showR2: true
    }
  }
});

print(chart);


//====================================================
// 12. EXPORT NDVI
//====================================================

Export.image.toDrive({
  image: ndvi,
  description: 'SRM_NDVI',
  folder: 'GEE',
  region: srm,
  scale: 30,
  fileFormat: 'GeoTIFF',
  maxPixels: 1e13
});


//====================================================
// 13. EXPORT LST
//====================================================

Export.image.toDrive({
  image: lst,
  description: 'SRM_LST',
  folder: 'GEE',
  region: srm,
  scale: 30,
  fileFormat: 'GeoTIFF',
  maxPixels: 1e13
});
