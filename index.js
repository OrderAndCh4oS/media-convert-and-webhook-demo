#!/usr/bin/env node

import {fromIni} from '@aws-sdk/credential-provider-ini';
import {STS} from '@aws-sdk/client-sts';
import {
    CreateJobCommand,
    MediaConvertClient,
    GetJobCommand
} from '@aws-sdk/client-mediaconvert';
import {config} from 'dotenv';

config();

const MEDIA_CONVERT_ENDPOINT = process.env.MEDIA_CONVERT_ENDPOINT;
const JOB_ROLE = process.env.JOB_ROLE;
const BUCKET_NAME = process.env.BUCKET_NAME;

if(!MEDIA_CONVERT_ENDPOINT) throw new Error('Missing MEDIA_CONVERT_ENDPOINT .env variable')
if(!JOB_ROLE) throw new Error('Missing JOB_ROLE .env variable')
if(!BUCKET_NAME) throw new Error('Missing BUCKET_NAME .env variable')

async function assume(sourceCreds, params) {
    const sts = new STS({credentials: sourceCreds});
    const result = await sts.assumeRole(params);
    if(!result.Credentials) {
        throw new Error(
            'unable to assume credentials - empty credential object');
    }
    return {
        accessKeyId: String(result.Credentials.AccessKeyId),
        secretAccessKey: String(result.Credentials.SecretAccessKey),
        sessionToken: result.Credentials.SessionToken
    };
}

const client = new MediaConvertClient({
    region: 'eu-west-1',
    credentials: fromIni({
        profile: 'default',
        roleAssumer: assume
    }),
    endpoint: MEDIA_CONVERT_ENDPOINT,
});

const command = new CreateJobCommand({
    Role: JOB_ROLE,
    Settings: {
        OutputGroups: [
            {
                Name: 'Mp3 Group',
                OutputGroupSettings: {
                    Type: 'FILE_GROUP_SETTINGS',
                    FileGroupSettings: {
                        Destination: `s3://${BUCKET_NAME}/out/`
                    }
                },
                Outputs: [
                    {
                        AudioDescriptions: [
                            {
                                AudioTypeControl: 'FOLLOW_INPUT',
                                CodecSettings: {
                                    Codec: 'MP3',
                                    Mp3Settings: {
                                        AudioDescriptionBroadcasterMix: 'NORMAL',
                                        Bitrate: 160000,
                                        SampleRate: 48000,
                                        Specification: 'MPEG4',
                                        Channels: 2,
                                        RateControlMode: 'VBR',
                                        VbrQuality: 4
                                    }
                                },
                                LanguageCodeControl: 'FOLLOW_INPUT'
                            }
                        ],
                        ContainerSettings: {
                            Container: "RAW"
                        }
                    }
                ]
            }
        ],
        AdAvailOffset: 0,
        Inputs: [
            {
                AudioSelectors: {
                    'Audio Selector 1': {
                        Tracks: [
                            1
                        ],
                        Offset: 0,
                        DefaultSelection: 'DEFAULT',
                        SelectorType: 'TRACK',
                        ProgramSelection: 1
                    }
                },
                TimecodeSource: 'EMBEDDED',
                FileInput: `s3://${BUCKET_NAME}/music.mp3`
            }
        ]
    }
});

const getJob = (data) => async () =>
    new Promise(async (resolve, reject) => {
        const job = await client.send(new GetJobCommand({Id: data.Job.Id}));
        console.log('Job:', job.Job);
        if(job.Job.Status === 'COMPLETE') {
            resolve(true);
            return
        }
        if(job.Job.Status === 'ERROR') {
            reject(false);
            return
        }
        setTimeout(getJob(data), 200);
    })


try {
    const data = await client.send(command);
    console.log(JSON.stringify(data));
    const result = await getJob(data)();
    console.log(result);

} catch(error) {
    console.log(error)
} finally {
    console.log('~~fin~~')
}
