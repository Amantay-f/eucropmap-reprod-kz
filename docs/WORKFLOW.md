1) Open gee/01_s1_export_tasks.js in Google Earth Engine and click Run to create export tasks (Sentinel-1 10-day VV/VH composites). 

2) In the Tasks tab, run all exports and wait until CSV shards appear in Google Drive. 

3) Download the exported CSV shards and place them into data/raw/ (this folder is not tracked by git). 

4) Run notebooks/01_preprocess_exports.ipynb. 

5) It merges all CSV shards, cleans columns, and prepares a single training table. 

6) Output is written to data/prepared/ (e.g., S1_point_all_10d_10m_20180101-20180731_Stratum1_VV-VH.csv). 

7) Run notebooks/02_train_rf.ipynb. 

8) It filters to crop-only Level-2 classes and selects VV/VH features for the chosen months. 

9) It tunes a Random Forest (RandomizedSearchCV) and saves models/RF_best_model_bigger.pkl + models/RF_feature_names.json. 
