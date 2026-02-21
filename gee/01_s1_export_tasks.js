//=======================================================================================================================================
// EC-JRC 2021 (adapted): Create Sentinel-1 10-day VV & VH composites and sample them on LUCAS Copernicus polygons
// This version is trimmed for your use case:
//   • Time window: 2018-01-01 .. 2018-07-31 (Jan–Jul) to match RF training
//   • Polarizations: VV & VH only (no VH/VV ratio) to reduce memory
//   • Regions: Stratum 1 only (NW/NE rectangles). Mediterranean (SW/SE) excluded
//   • Bigger tileScale (32) to avoid “out of memory (8)”
//   • Exports go to your Drive folder 'EU_reprod'
//=======================================================================================================================================


// ---------------------------
// A) INPUTS / CONSTANTS
// ---------------------------


// 1) Dates (Jan–Jul 2018)
var start_date = '2018-01-01';
var end_date   = '2018-07-31';


// 2) Time step (days)
var step = 10;


// 3) Pixel spacing
var pix_export = 10;


// 4) Source polygons (public LUCAS Copernicus 2018 FC)
var parcel = ee.FeatureCollection("JRC/LUCAS_HARMO/COPERNICUS_POLYGONS/V1/2018");


// Normalize to expected field names (POINT_ID, LC1, LU1)
parcel = parcel.map(function(f) {
  return f.set({
    'POINT_ID': f.get('point_id'),
    'LC1': f.get('lc1'),
    'LU1': f.get('lu1')
  }).select(['POINT_ID','LC1','LU1']);
});
print('Parcels (all classes), count:', parcel.size());


// 5) EU rectangles (from repo)
var EU_NW1  = ee.Geometry.Rectangle(-13.69, 48.00,   0.00, 70.1);
var EU_NW2a = ee.Geometry.Rectangle(  0.00, 48.00,  13.00, 50.0);
var EU_NW2b = ee.Geometry.Rectangle(  0.00, 50.00,  13.00, 70.1);
var EU_NE1a = ee.Geometry.Rectangle( 13.00, 48.00,  23.50, 51.0);
var EU_NE1b = ee.Geometry.Rectangle( 13.00, 51.00,  23.50, 56.0);
var EU_NE1c = ee.Geometry.Rectangle( 13.00, 56.00,  23.50, 60.0);
var EU_NE1d = ee.Geometry.Rectangle( 13.00, 60.00,  23.50, 70.1);
var EU_NE2  = ee.Geometry.Rectangle( 23.50, 48.00,  34.70, 70.1);


// Mediterranean (Stratum 2) rectangles — we define but DO NOT export from them
var EU_SW1  = ee.Geometry.Rectangle(-13.69, 32.63,   0.00, 48.0);
var EU_SW2  = ee.Geometry.Rectangle(  0.00, 35.50,  13.00, 48.0);
var EU_SE1  = ee.Geometry.Rectangle( 13.00, 32.63,  23.50, 48.0);
var EU_SE2  = ee.Geometry.Rectangle( 23.50, 32.63,  34.70, 48.0);


// Map overlays (optional)
Map.addLayer(EU_NW1,  {}, 'EU_NW1',  false);
Map.addLayer(EU_NW2a, {}, 'EU_NW2a', false);
Map.addLayer(EU_NW2b, {}, 'EU_NW2b', false);
Map.addLayer(EU_NE1a, {}, 'EU_NE1a', false);
Map.addLayer(EU_NE1b, {}, 'EU_NE1b', false);
Map.addLayer(EU_NE1c, {}, 'EU_NE1c', false);
Map.addLayer(EU_NE1d, {}, 'EU_NE1d', false);
Map.addLayer(EU_NE2,  {}, 'EU_NE2',  false);


// ---------------------------
// B) PREPARE PARCEL SUBSETS (Stratum 1 only)
// ---------------------------


// (Optional) If you want a hard stratum property on features, set it here:
var medGeom = ee.FeatureCollection([EU_SW1, EU_SW2, EU_SE1, EU_SE2]).geometry();
parcel = parcel.map(function(f){
  var s = ee.Number(ee.Algorithms.If(f.geometry().intersects(medGeom, ee.ErrorMargin(1)), 2, 1));
  return f.set('stratum', s);
});


// Keep only Stratum 1 polygons
parcel = parcel.filter(ee.Filter.eq('stratum', 1));


var parcel_EU_NW1  = parcel.filterBounds(EU_NW1);
var parcel_EU_NW2a = parcel.filterBounds(EU_NW2a);
var parcel_EU_NW2b = parcel.filterBounds(EU_NW2b);
var parcel_EU_NE1a = parcel.filterBounds(EU_NE1a);
var parcel_EU_NE1b = parcel.filterBounds(EU_NE1b);
var parcel_EU_NE1c = parcel.filterBounds(EU_NE1c);
var parcel_EU_NE1d = parcel.filterBounds(EU_NE1d);
var parcel_EU_NE2  = parcel.filterBounds(EU_NE2);


print('Counts Stratum 1:',
  parcel_EU_NW1.size(),
  parcel_EU_NW2a.size(),
  parcel_EU_NW2b.size(),
  parcel_EU_NE1a.size(),
  parcel_EU_NE1b.size(),
  parcel_EU_NE1c.size(),
  parcel_EU_NE1d.size(),
  parcel_EU_NE2.size()
);


// ---------------------------
// C) FUNCTIONS
// ---------------------------


function toNatural(img) {
  // convert dB → linear (apply to all bands)
  return ee.Image(10.0).pow(img.divide(10.0)).copyProperties(img, ['system:time_start']);
}


function toDB(img) {
  // convert linear → dB
  return ee.Image(img).log10().multiply(10.0).copyProperties(img, ['system:time_start']);
}


// Mask dark “edge” artifacts
function maskEdge(img) {
  var mask = img.select(0).unitScale(-25, 5).multiply(255).toByte()
              .connectedComponents(ee.Kernel.rectangle(1,1), 100);
  return img.updateMask(mask.select(0).abs());
}


// Add bands together
function stack(i1, i2) {
  return ee.Image(i1).addBands(ee.Image(i2));
}


// ---------------------------
// D) S1 PREPROCESSING & TEMPORAL COMPOSITES (VV/VH only)
// ---------------------------


var s1 = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filter(ee.Filter.eq('instrumentMode', 'IW'))
  // Properly test for both polarisations present:
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
  .filterDate(start_date, end_date)
  .sort('system:time');


Map.addLayer(s1.first(), {}, 'S1 sample', false);


// Mask edges and work in linear for averaging
var s1_lin = s1.map(maskEdge).map(toNatural);


// 10-day windows
var days = ee.List.sequence(0, ee.Date(end_date).difference(ee.Date(start_date), 'day'), step)
  .map(function(d) { return ee.Date(start_date).advance(d, 'day'); });


var dates = days.slice(0, -1).zip(days.slice(1));
print('windows', dates);


// For each window, mean composite and keep VV/VH; then convert back to dB
var s1res = dates.map(function(range) {
  var t0 = ee.Date(ee.List(range).get(0));
  var t1 = ee.Date(ee.List(range).get(1));
  var dstamp = t0.format('YYYYMMdd');
  var meanLin = s1_lin.filterDate(t0, t1).mean();
  var meanDB  = toDB(meanLin.select(['VV','VH'], [ee.String('VV_').cat(dstamp), ee.String('VH_').cat(dstamp)]));
  return meanDB;
});


// Stack all composite images into a single multiband image
var s1stack = ee.Image(s1res.slice(1).iterate(stack, s1res.get(0))).toFloat();
print('s1stack bands:', s1stack.bandNames());
Map.addLayer(s1stack, {}, 's1stack (Jan–Jul VV/VH)', false);


// ---------------------------
// E) SAMPLE & EXPORT (Stratum 1 rectangles ONLY)
// ---------------------------


function sampleAndExport(fc, regionLabel) {
  var samp = s1stack.sampleRegions({
    collection: fc,
    properties: ['POINT_ID','stratum','LC1','LU1'],
    scale: pix_export,
    tileScale: 16,   // <-- must be 1..16
    geometries: false
  });


  Export.table.toDrive({
    collection: samp,
    description: 'S1_point_all_10d_10m_20180101-20180731_' + regionLabel,
    fileNamePrefix: 'S1_point_all_10d_10m_20180101-20180731_' + regionLabel + '_ratio-db',
    folder: 'EU_reprod',
    fileFormat: 'CSV'
  });
}




// Export Stratum 1 (NW/NE) only
sampleAndExport(parcel_EU_NW1,  'EU_NW1');
sampleAndExport(parcel_EU_NW2a, 'EU_NW2a');
sampleAndExport(parcel_EU_NW2b, 'EU_NW2b');
sampleAndExport(parcel_EU_NE1a, 'EU_NE1a');
sampleAndExport(parcel_EU_NE1b, 'EU_NE1b');
sampleAndExport(parcel_EU_NE1c, 'EU_NE1c');
sampleAndExport(parcel_EU_NE1d, 'EU_NE1d');
sampleAndExport(parcel_EU_NE2,  'EU_NE2');


// NOTE: We intentionally do NOT export EU_SW1, EU_SW2, EU_SE1, EU_SE2 (Stratum 2).
