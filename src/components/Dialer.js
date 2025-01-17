import React from 'react';
import PropTypes from 'prop-types';
import { graphql } from 'react-apollo';
import styled from 'styled-components';
import { connect } from 'react-redux';
import { trim, get } from 'lodash';
import { compose, pure, withPropsOnChange, withHandlers, getContext } from 'recompose';
import sleep from 'sleep-promise';
import TextField from '@material-ui/core/TextField';
import IconButton from '@material-ui/core/IconButton';
import CallIcon from '@material-ui/icons/Call';
import CallEndIcon from '@material-ui/icons/CallEnd';
import PhoneInTalkIcon from '@material-ui/icons/PhoneInTalk';
import { translate } from 'react-i18next';
import {
  SIP_STATUS_CONNECTED,
  CALL_STATUS_IDLE,
  CALL_STATUS_STARTING,
  CALL_STATUS_ACTIVE,
} from 'react-sip';
import { DialerInfo } from '../graphql/queries';
import { GenerateSipConfig, UpdateDialer } from '../graphql/mutations';

const Wrapper = styled.div`
  display: flex;
  flex-grow: 1;
  align-items: center;
  justify-content: center;
  padding-top: 10px;  
`;
const CallForm = styled.div`
  max-width: 600px;
  display: flex;
  align-items: center;
`;
const ActionButtonWrapper = styled.div`
  width: 40px;
`;

const Dialer = ({
  phoneNumber,
  phoneNumberIsValid,
  phoneNumberIsEmpty,
  onPhoneNumberChange,
  onPhoneNumberFocus,
  onPhoneNumberKeyDown,
  onStartButtonClick,
  onStopButtonClick,
  callStatus,
  helperTextLabel,
  t,
}) => (
  <Wrapper>
    <CallForm>
      <TextField
        label={callStatus === CALL_STATUS_IDLE ? t('dialer.label') : ' '}
        placeholder={t('dialer.sample')}
        error={!phoneNumberIsEmpty && !phoneNumberIsValid}
        helperText={helperTextLabel ? t(helperTextLabel) : ' '}
        value={phoneNumber}
        disabled={callStatus !== CALL_STATUS_IDLE}
        InputProps={{
          onChange: onPhoneNumberChange,
          onFocus: onPhoneNumberFocus,
          onKeyDown: onPhoneNumberKeyDown,
        }}
      />
      <ActionButtonWrapper>
        {callStatus === CALL_STATUS_IDLE ? (
          <IconButton
            color={phoneNumberIsEmpty || !phoneNumberIsValid ? undefined : 'primary'}
            disabled={phoneNumberIsEmpty || !phoneNumberIsValid}
            onClick={onStartButtonClick}
          >
            <CallIcon />
          </IconButton>
        ) : null}
        {callStatus === CALL_STATUS_ACTIVE ? (
          <IconButton color="primary" onClick={onStopButtonClick}>
            <CallEndIcon />
          </IconButton>
        ) : null}
        {callStatus === CALL_STATUS_STARTING ? (
          <IconButton color="primary" onClick={onStopButtonClick}>
            <PhoneInTalkIcon />
          </IconButton>
        ) : null}
      </ActionButtonWrapper>
    </CallForm>
  </Wrapper>
);

export default compose(
  translate('translations'),
  withPropsOnChange([], () => ({
    requireLogin: () => {
      window.location.href = '/login';
    },
  })),
  graphql(GenerateSipConfig, { name: 'generateSipConfig' }),
  graphql(UpdateDialer, { name: 'updateDialer' }),
  graphql(DialerInfo, {
    props: ({ data: { dialer = {} } }) => ({
      phoneNumber: dialer.phoneNumber || '',
    }),
  }),
  getContext({
    startCall: PropTypes.func,
    stopCall: PropTypes.func,
    sip: PropTypes.object,
    call: PropTypes.object,
    updateSipConfig: PropTypes.func,
  }),
  withPropsOnChange(['sip'], ({ sip }) => ({
    sipStatus: sip.status,
  })),
  withPropsOnChange(['call'], ({ call }) => ({
    callStatus: call.status,
  })),
  connect(
    () => ({}),
    (dispatch) => ({
      addToCallLog: (entry) =>
        dispatch({
          type: 'callLog/ADD',
          entry,
        }),
    }),
  ),
  withPropsOnChange(['phoneNumber'], ({ phoneNumber }) => {
    const phoneNumberIsEmpty = trim(phoneNumber) === '';
    let phoneNumberIsValid = true;
    return {
      phoneNumberIsValid,
      phoneNumberIsEmpty,
    };
  }),
  withPropsOnChange(['callStatus'], ({ callStatus }) => {
    let helperTextLabel = null;
    if (callStatus === CALL_STATUS_STARTING) {
      helperTextLabel = 'dialer.dialing';
    }
    if (callStatus === CALL_STATUS_ACTIVE) {
      helperTextLabel = 'dialer.onAir';
    }
    return {
      helperTextLabel,
      callStatus: callStatus || CALL_STATUS_IDLE,
    };
  }),
  withHandlers({
    getSipStatus: ({ sipStatus }) => () => sipStatus,
  }),
  withHandlers({
    startCallIfNeeded: ({
      getSipStatus,
      callStatus,
      phoneNumberIsValid,
      phoneNumber,
      updateDialer,
      startCall,
      addToCallLog,
      generateSipConfig,
      requireLogin,
      updateSipConfig,
    }) => async () => {
      if (callStatus === CALL_STATUS_IDLE && phoneNumberIsValid) {
        let phoneNumberForSip = phoneNumber;
        let phoneNumberForLog = phoneNumber;
        await updateDialer({ variables: { phoneNumber: phoneNumberForLog } });
        try {
          const response = await generateSipConfig({
            variables: {
              phoneNumber: phoneNumberForSip,
            },
          });
          const config = get(response, ['data', 'generateSipConfig', 'config']);
          updateSipConfig(config);
          let i = 50;
          while (i > 0 && getSipStatus() !== SIP_STATUS_CONNECTED) {
            // eslint-disable-next-line no-await-in-loop
            console.log('current status was: ', getSipStatus());
            await sleep(100);
            i -= 1;
          }
          console.log('current status: ', getSipStatus());
          startCall(phoneNumberForSip);
          addToCallLog({
            phoneNumber: phoneNumberForLog,
            startTimestamp: +new Date(),
          });
        } catch (e) {
          console.error('error calling :', e);
          // requireLogin();
        }
      }
    },
  }),
  withHandlers({
    onPhoneNumberChange: ({ updateDialer }) => (e) => {
      updateDialer({ variables: { phoneNumber: e.target.value } });
    },
    onPhoneNumberFocus: ({ callStatus }) => (e) => {
      const { target } = e;
      setTimeout(() => {
        if (callStatus === CALL_STATUS_IDLE && target) {
          target.select();
        }
      }, 50);
    },
    onPhoneNumberKeyDown: ({ startCallIfNeeded }) => (e) => {
      if (e.which === 13) {
        // enter
        startCallIfNeeded();
      }
    },
    onStartButtonClick: ({ startCallIfNeeded }) => () => {
      startCallIfNeeded();
    },
    onStopButtonClick: ({ stopCall, callStatus }) => () => {
      if (callStatus === CALL_STATUS_ACTIVE) {
        stopCall();
      }
    },
  }),
  pure,
)(Dialer);
