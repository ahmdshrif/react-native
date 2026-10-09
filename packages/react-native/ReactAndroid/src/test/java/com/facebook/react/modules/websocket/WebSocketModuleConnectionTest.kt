/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Conflicting okhttp versions
@file:Suppress("DEPRECATION_ERROR")

package com.facebook.react.modules.websocket

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.internal.featureflags.ReactNativeFeatureFlagsForTests
import com.facebook.react.modules.network.ForwardingCookieHandler
import com.facebook.react.modules.network.OkHttpClientProvider
import com.facebook.testutils.shadows.ShadowArguments
import com.facebook.testutils.shadows.ShadowInspectorNetworkReporter
import com.facebook.testutils.shadows.ShadowSoLoader
import okhttp3.OkHttpClient
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.MockedConstruction
import org.mockito.Mockito.RETURNS_SELF
import org.mockito.Mockito.mockConstruction
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.isNull
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/** Tests the connection lifecycle of [WebSocketModule]. */
@Config(
    shadows =
        [ShadowArguments::class, ShadowSoLoader::class, ShadowInspectorNetworkReporter::class],
)
@RunWith(RobolectricTestRunner::class)
class WebSocketModuleConnectionTest {

  private lateinit var context: ReactApplicationContext
  private lateinit var webSocket: WebSocket
  private lateinit var webSocketClient: OkHttpClient
  private lateinit var cookieHandlerConstruction: MockedConstruction<ForwardingCookieHandler>
  private lateinit var module: WebSocketModule

  @Before
  fun setUp() {
    ReactNativeFeatureFlagsForTests.setUp()

    webSocket = mock()
    webSocketClient = mock()
    whenever(webSocketClient.newWebSocket(any(), any())).thenReturn(webSocket)

    val clientBuilder = mock<OkHttpClient.Builder>(defaultAnswer = RETURNS_SELF)
    whenever(clientBuilder.build()).thenReturn(webSocketClient)
    val baseClient = mock<OkHttpClient>()
    whenever(baseClient.newBuilder()).thenReturn(clientBuilder)
    OkHttpClientProvider.client = baseClient

    cookieHandlerConstruction = mockConstruction(ForwardingCookieHandler::class.java)

    context = mock()
    whenever(context.hasActiveReactInstance()).thenReturn(true)

    module = WebSocketModule(context)
  }

  @After
  fun tearDown() {
    cookieHandlerConstruction.close()
    OkHttpClientProvider.client = null
  }

  private fun connect(socketId: Int): WebSocketListener {
    module.connect("ws://example.com/socket", null, null, socketId.toDouble())
    val listener = argumentCaptor<WebSocketListener>()
    verify(webSocketClient).newWebSocket(any(), listener.capture())
    return listener.firstValue
  }

  @Test
  fun invalidate_closesSocketThatIsStillConnecting() {
    connect(socketId = 0)

    module.invalidate()

    verify(webSocket).close(eq(1_001), isNull())
  }

  @Test
  fun close_closesSocketThatIsStillConnecting() {
    connect(socketId = 0)

    module.close(1_000.0, "bye", 0.0)

    verify(webSocket).close(1_000, "bye")
  }

  @Test
  fun onOpen_emitsOpenEvent() {
    val listener = connect(socketId = 0)

    listener.onOpen(webSocket, mock<Response>())

    verify(context).emitDeviceEvent(eq("websocketOpen"), any())
  }

  @Test
  fun invalidate_dropsEventsDeliveredAfterwards() {
    val listener = connect(socketId = 0)

    module.invalidate()
    // The handshake of a socket that was connecting at reload completes, then the socket closes.
    listener.onOpen(webSocket, mock<Response>())
    listener.onMessage(webSocket, "hello")
    listener.onClosed(webSocket, 1_001, "")
    listener.onFailure(webSocket, RuntimeException("boom"), null)

    verify(context, never()).emitDeviceEvent(any(), any())
  }
}
