import { useState } from 'react';
import { Upload, CheckCircle, AlertCircle, FileText, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { calcIDPFdpValue } from '../lib/fdp/calcFdpValue';
import { isIDPPosition, getIDPPositionLabel, getSubPositionLabel } from '../lib/idp/idpMultipliers';
import { getFormatWithPreset, getPresetLabel, getPresetIcon, type IDPScoringPreset } from '../lib/idp/getIdpPreset';

interface CSVRow {
  full_name: string;
  position: string;
  sub_position?: string;
  team?: string;
  base_value: number;
  rank: number;
}

export default function IDPAdminUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    playersUpserted: number;
    snapshotsCreated: number;
    errors?: string[];
  } | null>(null);
  const [baseFormat, setBaseFormat] = useState<'dynasty_sf_idp' | 'dynasty_1qb_idp'>('dynasty_sf_idp');
  const [scoringPreset, setScoringPreset] = useState<IDPScoringPreset>('balanced');

  const selectedFormat = getFormatWithPreset(baseFormat, scoringPreset);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const parseCSV = async (file: File): Promise<CSVRow[]> => {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());

    if (lines.length === 0) {
      throw new Error('CSV file is empty');
    }

    const header = lines[0].toLowerCase().split(',').map(h => h.trim());
    const requiredFields = ['full_name', 'position', 'base_value', 'rank'];

    for (const field of requiredFields) {
      if (!header.includes(field)) {
        throw new Error(`Missing required column: ${field}`);
      }
    }

    const rows: CSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());

      if (values.length < 4) continue;

      const row: any = {};
      header.forEach((key, idx) => {
        row[key] = values[idx];
      });

      rows.push({
        full_name: row.full_name,
        position: row.position.toUpperCase(),
        sub_position: row.sub_position?.toUpperCase() || undefined,
        team: row.team?.toUpperCase() || undefined,
        base_value: parseInt(row.base_value) || 0,
        rank: parseInt(row.rank) || 0,
      });
    }

    return rows;
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    const errors: string[] = [];

    try {
      const rows = await parseCSV(file);

      let playersUpserted = 0;
      let snapshotsCreated = 0;

      for (const row of rows) {
        if (!isIDPPosition(row.position)) {
          errors.push(`Invalid IDP position for ${row.full_name}: ${row.position}`);
          continue;
        }

        const playerId = `${row.full_name.replace(/\s+/g, '_').toLowerCase()}_${row.position.toLowerCase()}`;

        const { error: playerError } = await supabase
          .from('player_values')
          .upsert({
            player_id: playerId,
            player_name: row.full_name,
            position: row.position,
            sub_position: row.sub_position,
            team: row.team,
            base_value: row.base_value,
            position_group: 'IDP',
            tier: row.base_value >= 4000 ? 'elite' : row.base_value >= 3000 ? 'strong' : row.base_value >= 2000 ? 'solid' : 'flex',
            last_updated: new Date().toISOString(),
          }, {
            onConflict: 'player_id',
          });

        if (playerError) {
          errors.push(`Failed to upsert player ${row.full_name}: ${playerError.message}`);
          continue;
        }

        playersUpserted++;

        const fdpValue = calcIDPFdpValue(row.base_value, row.position, selectedFormat, row.sub_position);

        const { error: snapshotError } = await supabase
          .from('ktc_value_snapshots')
          .insert({
            player_id: playerId,
            full_name: row.full_name,
            position: row.position,
            team: row.team,
            position_rank: row.rank,
            ktc_value: row.base_value,
            fdp_value: fdpValue,
            format: selectedFormat,
            source: 'manual_seed',
            captured_at: new Date().toISOString(),
          });

        if (snapshotError) {
          errors.push(`Failed to create snapshot for ${row.full_name}: ${snapshotError.message}`);
          continue;
        }

        snapshotsCreated++;
      }

      setResult({
        success: true,
        message: `Successfully processed ${rows.length} players`,
        playersUpserted,
        snapshotsCreated,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (err) {
      setResult({
        success: false,
        message: err instanceof Error ? err.message : 'Upload failed',
        playersUpserted: 0,
        snapshotsCreated: 0,
      });
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    const template = `full_name,position,sub_position,team,base_value,rank
T.J. Watt,DL,EDGE,PIT,4500,1
Micah Parsons,LB,OLB,DAL,4800,1
Fred Warner,LB,ILB,SF,4300,2
Roquan Smith,LB,ILB,BAL,4000,3
Derwin James,DB,S,LAC,3800,1
Antoine Winfield Jr.,DB,S,TB,3600,2
Patrick Surtain II,DB,CB,DEN,3500,3`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'idp_upload_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">IDP Admin Upload</h2>
        <p className="text-sm text-gray-600 mt-1">
          Upload IDP player rankings via CSV to seed or update defensive player values
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          CSV Format Requirements
        </h3>
        <div className="text-sm text-blue-800 space-y-1">
          <p><strong>Required columns:</strong> full_name, position, base_value, rank</p>
          <p><strong>Optional columns:</strong> sub_position, team</p>
          <p><strong>Valid positions:</strong> DL, LB, DB</p>
          <p><strong>Valid sub_positions:</strong> EDGE, DT, NT, ILB, OLB, MLB, CB, S, FS, SS</p>
          <p><strong>Value range:</strong> 0 - 10,000 (similar to offensive player scale)</p>
        </div>
        <button
          onClick={downloadTemplate}
          className="mt-3 flex items-center gap-2 text-sm text-blue-700 hover:text-blue-900 font-medium"
        >
          <Download className="w-4 h-4" />
          Download Template CSV
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              League Format
            </label>
            <select
              value={baseFormat}
              onChange={(e) => setBaseFormat(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="dynasty_sf_idp">Dynasty Superflex + IDP</option>
              <option value="dynasty_1qb_idp">Dynasty 1QB + IDP</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Scoring Preset
            </label>
            <select
              value={scoringPreset}
              onChange={(e) => setScoringPreset(e.target.value as IDPScoringPreset)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="tackle_heavy">{getPresetIcon('tackle_heavy')} Tackle Heavy</option>
              <option value="balanced">{getPresetIcon('balanced')} Balanced</option>
              <option value="big_play">{getPresetIcon('big_play')} Big Play</option>
            </select>
          </div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="text-sm text-gray-700">
            <span className="font-semibold">Format:</span> {selectedFormat}
          </div>
          <div className="text-xs text-gray-600 mt-1">
            Values will be calculated using {getPresetLabel(scoringPreset)} scoring
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload CSV File
          </label>
          <div className="flex items-center gap-4">
            <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 cursor-pointer transition-colors">
              <Upload className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-600">
                {file ? file.name : 'Choose CSV file...'}
              </span>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {result && (
        <div
          className={`rounded-lg p-6 ${
            result.success
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          <div className="flex items-start gap-3">
            {result.success ? (
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <h3
                className={`font-semibold ${
                  result.success ? 'text-green-900' : 'text-red-900'
                }`}
              >
                {result.success ? 'Upload Successful' : 'Upload Failed'}
              </h3>
              <p
                className={`text-sm mt-1 ${
                  result.success ? 'text-green-800' : 'text-red-800'
                }`}
              >
                {result.message}
              </p>
              {result.success && (
                <div className="mt-3 grid grid-cols-2 gap-4">
                  <div className="bg-white/50 rounded px-3 py-2">
                    <div className="text-xs text-green-700">Players Upserted</div>
                    <div className="text-2xl font-bold text-green-900">
                      {result.playersUpserted}
                    </div>
                  </div>
                  <div className="bg-white/50 rounded px-3 py-2">
                    <div className="text-xs text-green-700">Snapshots Created</div>
                    <div className="text-2xl font-bold text-green-900">
                      {result.snapshotsCreated}
                    </div>
                  </div>
                </div>
              )}
              {result.errors && result.errors.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-semibold text-red-900 mb-2">
                    Errors ({result.errors.length}):
                  </p>
                  <ul className="text-xs text-red-800 space-y-1 max-h-40 overflow-y-auto">
                    {result.errors.slice(0, 10).map((error, idx) => (
                      <li key={idx}>• {error}</li>
                    ))}
                    {result.errors.length > 10 && (
                      <li className="font-semibold">
                        ... and {result.errors.length - 10} more errors
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-2">How Upload Works</h3>
        <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside">
          <li>Parses CSV and validates required columns</li>
          <li>Generates unique player_id from name and position</li>
          <li>Upserts player record into player_values table with position_group='IDP'</li>
          <li>Calculates FDP value using IDP multipliers and adjustments</li>
          <li>Creates snapshot in ktc_value_snapshots with source='manual_seed'</li>
          <li>Reports success count and any errors encountered</li>
        </ol>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-semibold text-yellow-900 mb-2">Important Notes</h3>
        <ul className="text-sm text-yellow-800 space-y-1">
          <li>• Duplicate uploads will update existing players</li>
          <li>• New snapshots are always created (historical tracking)</li>
          <li>• Base values should be on similar scale to offensive players</li>
          <li>• FDP values are auto-calculated with IDP-specific adjustments</li>
          <li>• Position groups and sub-positions are automatically set</li>
        </ul>
      </div>
    </div>
  );
}
