# eucropmap-reprod-kz
Reproduction + adaptation of the EUCROPMAP Sentinel-1 crop-mapping pipeline: GEE exports 10-day VV/VH composites, Python/Colab merges exports and trains a Random Forest crop classifier.
# EUCROPMAP reproduction + Kazakhstan adaptation (Sentinel-1 + Random Forest)

This repository reproduces a crop-mapping workflow inspired by EUCROPMAP:
1) export Sentinel-1 10-day VV/VH composites sampled on polygons in **Google Earth Engine**
2) merge/clean exports in **Python (Colab/Jupyter)**
3) train a **Random Forest** crop classifier (crop-only classes)

## Project structure
- `gee/01_s1_export_tasks.js` — creates GEE export tasks (CSV shards)
- `notebooks/01_preprocess_exports.ipynb` — merges shards + builds final training table
- `notebooks/02_train_rf.ipynb` — trains RF + saves model artifacts
- `data/raw/` — place GEE-exported CSVs here (not tracked by git)
- `data/prepared/` — merged outputs created by preprocessing notebook
- `models/` — trained model (`.pkl`) and `RF_feature_names.json`

## Quickstart (recommended: Google Colab)
### Step A — Export data in GEE
1. Open `gee/01_s1_export_tasks.js` in the Earth Engine Code Editor
2. Press **Run** → it will create multiple **Export.table.toDrive** tasks
3. In the **Tasks** tab, click **Run** on each export and wait until CSVs appear in Drive

> In the current script, exports are configured for Jan–Jul 2018 and Stratum 1 only.
> You can modify the date window and AOI for Kazakhstan.

### Step B — Preprocess exports (Python)
1. Download the exported CSVs and put them into:
   - `data/raw/`
2. Run:
   - `notebooks/01_preprocess_exports.ipynb`
3. This creates:
   - `data/prepared/S1_point_all_10d_10m_20180101-20180731_Stratum1_VV-VH.csv`

### Step C — Train model (Python)
1. Run:
   - `notebooks/02_train_rf.ipynb`
2. This saves:
   - `models/RF_best_model_bigger.pkl`
   - `models/RF_feature_names.json`

## Notes on class filtering and time window
- Training filters to an “official” Level-2 crop subset (see `02_train_rf.ipynb`).
- For the Kazakhstan adaptation, the season window can be shifted (e.g., April–September) by:
  - updating dates in the GEE script
  - updating the feature regex in the training notebook

## Data
This repo does not include full exported datasets.
Place exports in `data/raw/` as described above.
