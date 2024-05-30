import json
from IPython import embed
from matplotlib import figure
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

def read_jsonl(file_path):
    data = []
    with open(file_path, 'r') as f:
        for line in f:
            if line.strip().endswith('}'):
                data.append(json.loads(line))
    return data

# Load data into a DataFrame
df = pd.DataFrame(read_jsonl('data/testdata.txt'))

# Convert 'timestamp' to datetime
df['timestamp'] = pd.to_datetime(df['timestamp'].astype(float), unit='ms')

# Sort by 'dev_id' and 'timestamp'
df = df.sort_values(['dev_id', 'timestamp'])

# Calculate time delta
df['time_delta'] = df.groupby('dev_id', group_keys=False)['timestamp'].diff().dt.total_seconds()

# Plot histogram
df.set_index('dev_id').plot.scatter('timestamp', 'time_delta')
plt.title('Histogram of Time Deltas')
plt.savefig('timedeltas.png')

# Count unique dev_id per 5 minute window
unique_dev_ids = df.groupby(pd.Grouper(key='timestamp', freq='5min'))['dev_id'].nunique()

# Convert index to datetime
unique_dev_ids.index = pd.to_datetime(unique_dev_ids.index)

# Plot count of unique dev_id per 5 minute window
plt.figure(figsize=(20, 10))
unique_dev_ids.plot(kind='line')
plt.title('Count of Unique dev_id per 5 Minute Window')
plt.xlabel('Window')
plt.ylabel('Count')
plt.savefig('unique_dev_ids.png')
# embed()


# Create the plot
start_date = pd.Timestamp('2024-01-01')
dt = pd.date_range(df.timestamp.min(), df.timestamp.max(), freq='1min').to_series()
t = (dt - (start_date - pd.DateOffset(days=start_date.weekday()))).dt.total_seconds()
hour_wave = 0.05 * np.sin(2 * np.pi * t / (3600))
week_wave = 0.5 * np.sin(2 * np.pi * t / (24 * 7 * 3600))
day_wave = 1 * np.sin(2 * np.pi * t / (24 * 3600)) + week_wave + hour_wave

plt.figure(figsize=(14, 7))
plt.fill_between(dt, week_wave, day_wave, where=(day_wave >= week_wave), facecolor='lightblue', alpha=0.3, label='AM')
plt.fill_between(dt, week_wave, day_wave, where=(day_wave < week_wave), facecolor='lightcoral', alpha=0.3, label='PM')
# plt.plot(dt, day_wave + hour_wave, label='Day + Hour Cycle', color='grey', linewidth=1)
plt.plot(dt, day_wave, label='Day Cycle', color='deepskyblue', linewidth=2)
plt.title('AM and PM Cycles with Hourly Variation', fontsize=20)
plt.xlabel('Time (hours)', fontsize=14)
plt.ylabel('Amplitude', fontsize=14)
plt.legend()
plt.savefig('time.png')